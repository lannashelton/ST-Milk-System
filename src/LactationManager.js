import { extension_settings } from "../../../../extensions.js";

export class LactationManager {
    constructor() {
        this.character = null;
        this.state = {
            enabled: false,
            level: 1,
            exp: 0,
            breastSize: 'medium',
            currentMilk: 0,
            overfullCount: 0,
        };

        this.capacityMap = {
            small: 200,
            medium: 400,
            large: 600
        };

        this.globalMilkStorage = 0;
    }

    setCharacter(character) {
        if (!character || character.name === this.character?.name) return;

        this.character = character;
        this.loadState();
    }

    getVarName(variable) {
        if (!this.character) return null;
        return `${this.character.name.replace(/\s+/g, '_')}_${variable}`;
    }

    getGlobalVariable(name) {
        const varName = this.getVarName(name);
        if (!varName) return 0;

        return window[varName] ||
               (extension_settings.variables?.global?.[varName] || 0);
    }

    setGlobalVariable(name, value) {
        const varName = this.getVarName(name);
        if (!varName) return;

        window[varName] = value;
        if (!extension_settings.variables) {
            extension_settings.variables = { global: {} };
        }
        extension_settings.variables.global[varName] = value;
    }

    loadState() {
        if (!this.character) return;

        this.state.enabled = Boolean(this.getGlobalVariable('lactation_enabled')) || false;
        this.state.level = parseInt(this.getGlobalVariable('lactation_level')) || 1;
        this.state.exp = parseInt(this.getGlobalVariable('lactation_exp')) || 0;
        this.state.breastSize = this.getGlobalVariable('breast_size') || 'medium';
        this.state.currentMilk = parseFloat(this.getGlobalVariable('current_milk')) || 0;
        this.state.overfullCount = 0;
        this.globalMilkStorage = parseFloat(this.getGlobalVariable('global_milk_storage')) || 0;

        console.log('[LactationManager] State loaded:', this.state);
    }

    saveState() {
        if (!this.character) return;

        this.setGlobalVariable('lactation_enabled', this.state.enabled);
        this.setGlobalVariable('lactation_level', this.state.level);
        this.setGlobalVariable('lactation_exp', this.state.exp);
        this.setGlobalVariable('breast_size', this.state.breastSize);
        this.setGlobalVariable('current_milk', this.state.currentMilk);
        this.setGlobalVariable('global_milk_storage', this.globalMilkStorage);
    }

    enableLactation() {
        this.state.enabled = true;
        this.saveState();
        return `${this.character.name}'s lactation system is now active`;
    }

    disableLactation() {
        this.state.enabled = false;
        this.saveState();
        return `${this.character.name}'s lactation system is now disabled`;
    }

    setBreastSize(size) {
        if (['small', 'medium', 'large'].includes(size)) {
            this.state.breastSize = size;
            this.saveState();
            return `${this.character.name}'s breast size set to ${size}`;
        }
        return "Invalid breast size. Use small, medium, or large.";
    }

    getMilkCapacity() {
        const baseCapacity = this.capacityMap[this.state.breastSize] || 400;
        return baseCapacity * (1 + (this.state.level - 1) * 0.1);
    }

    produceMilk() {
        if (!this.character || !this.state.enabled) {
            console.log("[MilkProduction] Skipping - no character or disabled");
            return;
        }

        const settings = extension_settings.lactation_system;
        const milkProduced = (settings?.milkPerMessage || 10) *
                            (1 + (this.state.level - 1) * 0.05);

        this.state.currentMilk += milkProduced;
        console.log(`[MilkProduction] ${this.character.name} produced ${milkProduced.toFixed(1)}ml (Total: ${this.state.currentMilk.toFixed(1)}ml)`);

        const capacity = this.getMilkCapacity();
        if (this.state.currentMilk >= capacity) {
            this.state.overfullCount++;

            if (extension_settings.lactation_system?.enableSysMessages) {
                let message = "";
                if (this.state.overfullCount === 1) {
                    message = `${this.character.name}'s breasts feel uncomfortably full`;
                } else if (this.state.overfullCount === 4) {
                    message = `${this.character.name} winces from breast pain. Milk needs to be expressed!`;
                } else if (this.state.overfullCount >= 7) {
                    message = `${this.character.name} is in severe pain from engorged breasts!`;
                }

                if (message) {
                    // Store message to return instead of sending directly
                    this.lastWarning = message;
                }
            }
        }

        this.saveState();
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
                expGained = amount / 5;
                break;

            case 'suck':
                amount = Math.min(60, this.state.currentMilk);
                message = `${amount}ml was drunk directly from ${this.character}'s breasts`;
                expGained = amount / 4;
                break;

            case 'machine':
                amount = Math.min(100, this.state.currentMilk);
                this.globalMilkStorage += amount;
                message = `A milking machine extracted ${amount}ml from ${this.character}`;
                expGained = amount / 10;
                break;
        }

        this.state.currentMilk -= amount;
        this.addExp(Math.floor(expGained));

        if (this.state.currentMilk < this.getMilkCapacity()) {
            this.state.overfullCount = 0;
        }

        this.saveState();
        return { amount, message };
    }

    addExp(amount) {
        this.state.exp += amount;

        while (this.state.exp >= this.getRequiredExp()) {
            this.state.exp -= this.getRequiredExp();
            this.state.level = Math.min(10, this.state.level + 1);
        }

        this.saveState();
    }

    getRequiredExp() {
        return this.state.level * 100;
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
