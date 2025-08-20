import { extension_settings } from "../../../../extensions.js";

export class LactationManager {
    constructor() {
        this.character = 'Unknown';
        this.state = {
            enabled: false,
            level: 1,
            exp: 0,
            breastSize: 'medium', // small, medium, large
            currentMilk: 0,
            overfullCount: 0, // Counts messages since becoming full
        };

        // Milk production capacity per breast size (ml)
        this.capacityMap = {
            small: 200,
            medium: 400,
            large: 600
        };

        // Shared global milk storage
        this.globalMilkStorage = this.getGlobalVariable('global_milk_storage') || 0;
    }

    getVarName(variable) {
        return `${this.character.replace(/\s+/g, '_')}_${variable}`;
    }

    getGlobalVariable(name) {
        return window[name] || (extension_settings.variables?.global?.[name] || 0);
    }

    setGlobalVariable(name, value) {
        try {
            window[name] = value;
            if (!extension_settings.variables) {
                extension_settings.variables = { global: {} };
            }
            extension_settings.variables.global[name] = value;
        } catch (error) {
            console.error("[LactationManager] Variable set failed", error);
        }
    }

    setCharacter(name) {
        if (name === this.character) return;
        this.character = name;
        this.loadState();
    }

    loadState() {
        this.state.enabled = Boolean(this.getGlobalVariable(this.getVarName('lactation_enabled'))) || false;
        this.state.level = parseInt(this.getGlobalVariable(this.getVarName('lactation_level'))) || 1;
        this.state.exp = parseInt(this.getGlobalVariable(this.getVarName('lactation_exp'))) || 0;
        this.state.breastSize = this.getGlobalVariable(this.getVarName('breast_size')) || 'medium';
        this.state.currentMilk = parseFloat(this.getGlobalVariable(this.getVarName('current_milk'))) || 0;
        this.state.overfullCount = 0;
        this.globalMilkStorage = parseFloat(this.getGlobalVariable('global_milk_storage')) || 0;
    }

    saveState() {
        this.setGlobalVariable(this.getVarName('lactation_enabled'), this.state.enabled);
        this.setGlobalVariable(this.getVarName('lactation_level'), this.state.level);
        this.setGlobalVariable(this.getVarName('lactation_exp'), this.state.exp);
        this.setGlobalVariable(this.getVarName('breast_size'), this.state.breastSize);
        this.setGlobalVariable(this.getVarName('current_milk'), this.state.currentMilk);
        this.setGlobalVariable('global_milk_storage', this.globalMilkStorage);
    }

    enableLactation() {
        this.state.enabled = true;
        this.saveState();
        return `${this.character}'s lactation system is now active`;
    }

    disableLactation() {
        this.state.enabled = false;
        this.saveState();
        return `${this.character}'s lactation system is now disabled`;
    }

    setBreastSize(size) {
        if (['small', 'medium', 'large'].includes(size)) {
            this.state.breastSize = size;
            this.saveState();
            return `${this.character}'s breast size set to ${size}`;
        }
        return "Invalid breast size. Use small, medium, or large.";
    }

    getMilkCapacity() {
        const baseCapacity = this.capacityMap[this.state.breastSize] || 400;
        return baseCapacity * (1 + (this.state.level - 1) * 0.1); // +10% capacity per level
    }

    produceMilk() {
        if (!this.state.enabled || this.character === 'Unknown') return null;

        const settings = extension_settings.lactation_system;
        const milkProduced = (settings?.milkPerMessage || 10) *
                            (1 + (this.state.level - 1) * 0.05); // +5% production per level

        this.state.currentMilk += milkProduced;
        const capacity = this.getMilkCapacity();

        let sysMessage = null;

        // Fullness warnings
        if (this.state.currentMilk >= capacity) {
            this.state.overfullCount++;

            if (this.state.overfullCount === 1) {
                sysMessage = `${this.character}'s breasts feel uncomfortably full`;
            }
            else if (this.state.overfullCount === 4) {
                sysMessage = `${this.character} winces from breast pain. Milk needs to be expressed!`;
            }
            else if (this.state.overfullCount >= 7) {
                sysMessage = `${this.character} is in severe pain from engorged breasts!`;
            }
        }

        this.saveState();
        return sysMessage;
    }

    milk(method) {
        if (!this.state.enabled) {
            return { amount: 0, message: "Lactation is not enabled" };
        }

        if (this.state.currentMilk <= 0) {
            return { amount: 0, message: "No milk available" };
        }

        let amount = 0;
        let message = '';
        let expGained = 0;

        switch(method) {
            case 'hands':
                amount = Math.min(50, this.state.currentMilk);
                this.globalMilkStorage += amount;
                message = `${this.character} expressed ${amount}ml using their hands`;
                expGained = amount / 5; // 0.2 EXP per ml
                break;

            case 'suck':
                amount = Math.min(60, this.state.currentMilk);
                // Milk is consumed, not stored
                message = `${amount}ml was drunk directly from ${this.character}'s breasts`;
                expGained = amount / 4; // 0.25 EXP per ml
                break;

            case 'machine':
                amount = Math.min(100, this.state.currentMilk);
                this.globalMilkStorage += amount;
                message = `A milking machine extracted ${amount}ml from ${this.character}`;
                expGained = amount / 10; // 0.1 EXP per ml (faster but less EXP)
                break;
        }

        this.state.currentMilk -= amount;
        this.addExp(Math.floor(expGained));

        // Reset overfull counter when milked
        if (this.state.currentMilk < this.getMilkCapacity()) {
            this.state.overfullCount = 0;
        }

        this.saveState();
        return { amount, message };
    }

    addExp(amount) {
        this.state.exp += amount;

        // Check for level up (100 EXP per level)
        while (this.state.exp >= this.getRequiredExp()) {
            this.state.exp -= this.getRequiredExp();
            this.state.level = Math.min(10, this.state.level + 1);
        }

        this.saveState();
    }

    getRequiredExp() {
        return this.state.level * 100; // 100 for L1, 200 for L2, etc.
    }

    getProgress() {
        const capacity = this.getMilkCapacity();
        return {
            milkPercent: Math.min(100, (this.state.currentMilk / capacity) * 100),
            expPercent: (this.state.exp / this.getRequiredExp()) * 100,
            nextLevelExp: this.getRequiredExp()
        };
    }
}
