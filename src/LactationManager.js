import { extension_settings } from "../../../../extensions.js";
import { saveSettingsDebounced } from "../../../../../script.js";

export class LactationManager {
    constructor() {
        this.character = null;
        this.state = {
            enabled: false, // Disabled by default
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

        this.levelMilkMap = {
            1: 1,
            2: 2,
            3: 4,
            4: 6,
            5: 8,
            6: 10,
            7: 12,
            8: 14,
            9: 16,
            10: 18
        };

        this.levelExpRequirements = {
            1: 100,
            2: 250,
            3: 500,
            4: 1000,
            5: 2000,
            6: 4000,
            7: 8000,
            8: 16000,
            9: 32000,
            10: 64000
        };

        this.destination = 'global';
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

        const globalVar = window[varName] ||
                         (extension_settings.variables?.global?.[varName] || 0);
        return parseFloat(globalVar) || 0;
    }

    getSharedGlobal(name) {
        return parseFloat(extension_settings.variables?.global?.[name] || 0);
    }

    setGlobalVariable(name, value) {
        const varName = this.getVarName(name);
        if (!varName) return;

        window[varName] = value;
        if (!extension_settings.variables) {
            extension_settings.variables = { global: {} };
        }
        extension_settings.variables.global[varName] = value;
        saveSettingsDebounced();
    }

    setSharedGlobal(name, value) {
        if (!extension_settings.variables) {
            extension_settings.variables = { global: {} };
        }
        extension_settings.variables.global[name] = value;
        saveSettingsDebounced();
    }

    loadState() {
        if (!this.character) return;
    
        // Get the raw value from storage
        const enabledValue = this.getGlobalVariable('lactation_enabled');
    
        // Convert to boolean with proper fallback
        this.state.enabled = enabledValue === 1 || enabledValue === true;

        this.state.level = parseInt(this.getGlobalVariable('lactation_level')) || 1;
        this.state.exp = parseInt(this.getGlobalVariable('lactation_exp')) || 0;
        this.state.breastSize = this.getGlobalVariable('breast_size') || 'medium';
        this.state.currentMilk = parseFloat(this.getGlobalVariable('current_milk')) || 0;
        this.state.overfullCount = parseInt(this.getGlobalVariable('overfull_count')) || 0;
        this.destination = this.getGlobalVariable('milk_destination') || 'global';

        console.log('[LactationManager] State loaded:', this.state);
    }

    saveState() {
        if (!this.character) return;

        this.setGlobalVariable('lactation_enabled', this.state.enabled ? 1 : 0);
        this.setGlobalVariable('lactation_level', this.state.level);
        this.setGlobalVariable('lactation_exp', this.state.exp);
        this.setGlobalVariable('breast_size', this.state.breastSize);
        this.setGlobalVariable('current_milk', this.state.currentMilk);
        this.setGlobalVariable('overfull_count', this.state.overfullCount);
        this.setGlobalVariable('milk_destination', this.destination);
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

    setDestination(dest) {
        if (['global', 'personal', 'waste'].includes(dest)) {
            this.destination = dest;
            this.saveState();
            return `Milk will now go to ${dest === 'waste' ? 'waste' : dest + ' storage'}`;
        }
        return "Invalid destination";
    }

    getMilkCapacity() {
        const baseCapacity = this.capacityMap[this.state.breastSize] || 400;
        return baseCapacity * (1 + (this.state.level - 1) * 0.1);
    }

    getPersonalStorage() {
        if (!this.character) return 0;
        return this.getGlobalVariable('personal_storage') || 0;
    }

    setPersonalStorage(value) {
        if (!this.character) return;
        this.setGlobalVariable('personal_storage', value);
    }

    getGlobalStorage() {
        return this.getSharedGlobal('global_milk_storage') || 0;
    }

    setGlobalStorage(value) {
        this.setSharedGlobal('global_milk_storage', value);
    }

    getMilkPerMessage() {
        return this.levelMilkMap[this.state.level] || 1;
    }

    getRequiredExp() {
        return this.levelExpRequirements[this.state.level] || 100;
    }

    produceMilk() {
        if (!this.character || !this.state.enabled) return null;

        const milkProduced = this.getMilkPerMessage();
        this.state.currentMilk += milkProduced;
        console.log(`[MilkProduction] ${this.character.name} produced ${milkProduced}ml`);

        const capacity = this.getMilkCapacity();
        let sysMessage = null;

        if (this.state.currentMilk >= capacity) {
            this.state.overfullCount++;
            console.log(`[MilkProduction] Overfull count: ${this.state.overfullCount}`);

            if (this.state.overfullCount === 1) {
                sysMessage = `${this.character.name}'s breasts feel uncomfortably full`;
            } else if (this.state.overfullCount === 4) {
                sysMessage = `${this.character.name} winces from breast pain. Milk needs to be expressed!`;
            } else if (this.state.overfullCount >= 7) {
                sysMessage = `${this.character.name} is in severe pain from engorged breasts!`;
            }
        }

        this.saveState();
        return sysMessage;
    }

    milk(method) {
        if (!this.character || !this.state.enabled) {
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
                message = `${this.character.name} expressed ${amount}ml using their hands`;
                expGained = Math.max(1, Math.floor(amount / 5));
                break;

            case 'suck':
                amount = Math.min(60, this.state.currentMilk);
                message = `${amount}ml was drunk directly from ${this.character.name}'s breasts`;
                expGained = Math.max(1, Math.floor(amount / 4));
                break;

            case 'machine':
                amount = Math.min(100, this.state.currentMilk);
                message = `A milking machine extracted ${amount}ml from ${this.character.name}`;
                expGained = Math.max(1, Math.floor(amount / 10));
                break;
        }

        // Always consume milk
        this.state.currentMilk -= amount;

        // Handle storage based on destination (except for suck method)
        if (method !== 'suck') {
            switch(this.destination) {
                case 'global':
                    this.addToGlobalStorage(amount);
                    message += " (added to global storage)";
                    break;
                case 'personal':
                    this.addToPersonalStorage(amount);
                    message += " (added to personal storage)";
                    break;
                case 'waste':
                    message += " (wasted)";
                    break;
            }
        } else {
            // Suck method always wastes milk
            message += " (consumed)";
        }

        this.addExp(expGained);

        if (this.state.currentMilk < this.getMilkCapacity()) {
            this.state.overfullCount = 0;
        }

        this.saveState();
        return { amount, message };
    }

    addExp(amount) {
        this.state.exp += amount;

        while (this.state.exp >= this.getRequiredExp() && this.state.level < 10) {
            this.state.exp -= this.getRequiredExp();
            this.state.level++;
        }

        this.saveState();
    }

    // WALLET SYSTEM ================================
    getWallet() {
        if (!this.character) return 0;
        return this.getGlobalVariable('wallet') || 0;
    }

    setWallet(value) {
        if (!this.character) return;
        this.setGlobalVariable('wallet', value);
    }

    // MILK TRANSFER ================================
    transferMilk(source, destination, amount) {
        amount = parseFloat(amount);
        if (isNaN(amount) || amount <= 0) {
            return { success: false, message: "Invalid amount" };
        }

        let sourceAmount, newSourceAmount;
        let message = '';

        // Get source amount
        if (source === 'personal') {
            sourceAmount = this.getPersonalStorage();
        } else if (source === 'global') {
            sourceAmount = this.getGlobalStorage();
        } else {
            return { success: false, message: "Invalid source" };
        }

        // Check if enough milk
        if (sourceAmount < amount) {
            return { success: false, message: "Not enough milk" };
        }

        // Update source
        newSourceAmount = sourceAmount - amount;
        if (source === 'personal') {
            this.setPersonalStorage(newSourceAmount);
        } else {
            this.setGlobalStorage(newSourceAmount);
        }

        // Update destination
        if (destination === 'personal') {
            const current = this.getPersonalStorage();
            this.setPersonalStorage(current + amount);
            message = `Transferred ${amount}ml from ${source} to personal storage`;
        } else if (destination === 'global') {
            const current = this.getGlobalStorage();
            this.setGlobalStorage(current + amount);
            message = `Transferred ${amount}ml from ${source} to global storage`;
        } else {
            return { success: false, message: "Invalid destination" };
        }

        return { success: true, message };
    }

    // MILK SELLING ================================
    sellMilk(source, amount) {
        amount = parseFloat(amount);
        if (isNaN(amount) || amount <= 0) {
            return { success: false, message: "Invalid amount" };
        }

        let sourceAmount, newSourceAmount;

        // Get source amount
        if (source === 'personal') {
            sourceAmount = this.getPersonalStorage();
        } else if (source === 'global') {
            sourceAmount = this.getGlobalStorage();
        } else {
            return { success: false, message: "Invalid source" };
        }

        // Check if enough milk
        if (sourceAmount < amount) {
            return { success: false, message: "Not enough milk" };
        }

        // Update source
        newSourceAmount = sourceAmount - amount;
        if (source === 'personal') {
            this.setPersonalStorage(newSourceAmount);
        } else {
            this.setGlobalStorage(newSourceAmount);
        }

        // Calculate money (10ml = $1)
        const moneyEarned = amount / 10;
        const currentWallet = this.getWallet();
        this.setWallet(currentWallet + moneyEarned);

        return {
            success: true,
            message: `Sold ${amount}ml for $${moneyEarned.toFixed(2)}`,
            amount: amount,
            money: moneyEarned
        };
    }

    getProgress() {
        const capacity = this.getMilkCapacity();
        return {
            milkPercent: Math.min(100, (this.state.currentMilk / capacity) * 100),
            expPercent: (this.state.exp / this.getRequiredExp()) * 100,
            nextLevelExp: this.getRequiredExp(),
            personalStorage: this.getPersonalStorage(),
            milkPerMessage: this.getMilkPerMessage(),
            wallet: this.getWallet()
        };
    }
}
