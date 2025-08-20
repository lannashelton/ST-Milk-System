import { extension_settings } from "../../../../extensions.js";

export class LactationPanel {
    constructor(manager) {
        this.manager = manager;
        this.isVisible = false;
        this.domElement = null;
    }

    createPanel() {
        const panel = document.createElement('div');
        panel.id = 'lactation-panel';
        panel.className = 'lactation-panel';

        const characterName = this.manager.character?.name || 'No Character';
        const progress = this.manager.getProgress();
        const globalStorage = this.manager.getGlobalStorage();

        panel.innerHTML = `
            <div class="lactation-header">
                <h3>Lactation System - ${characterName}</h3>
                <div class="lactation-actions">
                    <span class="lactation-action" id="lactation-refresh">↻</span>
                    <span class="lactation-action" id="lactation-close">×</span>
                </div>
            </div>
            <div class="lactation-content">
                ${this.manager.character ? `
                <div class="lactation-toggle">
                    <label>Lactation Enabled:</label>
                    <input type="checkbox" id="lactation-enabled" ${this.manager.state.enabled ? 'checked' : ''}>
                </div>

                <div class="breast-size-selector">
                    <label>Breast Size:</label>
                    <select id="breast-size-select">
                        <option value="small" ${this.manager.state.breastSize === 'small' ? 'selected' : ''}>Small</option>
                        <option value="medium" ${this.manager.state.breastSize === 'medium' ? 'selected' : ''}>Medium</option>
                        <option value="large" ${this.manager.state.breastSize === 'large' ? 'selected' : ''}>Large</option>
                    </select>
                </div>

                <div class="destination-selector">
                    <label>Milk Destination:</label>
                    <select id="destination-select">
                        <option value="global" ${this.manager.destination === 'global' ? 'selected' : ''}>Global Storage</option>
                        <option value="personal" ${this.manager.destination === 'personal' ? 'selected' : ''}>Personal Storage</option>
                        <option value="waste" ${this.manager.destination === 'waste' ? 'selected' : ''}>Waste</option>
                    </select>
                </div>

                <div class="milk-display">
                    <div class="milk-bar-container">
                        <div class="milk-bar" style="width: ${progress.milkPercent}%"></div>
                        <div class="milk-text">${this.manager.state.currentMilk.toFixed(1)}/${this.manager.getMilkCapacity().toFixed(1)} ml</div>
                    </div>
                    <div class="milk-label">Milk Level</div>
                </div>

                <div class="exp-display">
                    <div class="exp-bar-container">
                        <div class="exp-bar" style="width: ${progress.expPercent}%"></div>
                        <div class="exp-text">Level ${this.manager.state.level} (${this.manager.state.exp}/${progress.nextLevelExp} EXP)</div>
                    </div>
                </div>

                <div class="milking-actions">
                    <button class="milking-action" data-method="hands">Milk by Hand</button>
                    <button class="milking-action" data-method="suck">Suck Milk</button>
                    <button class="milking-action" data-method="machine">Use Machine</button>
                </div>

                <div class="storage-display">
                    <div class="storage-item">
                        <label>Personal Storage:</label>
                        <div class="storage-amount">${progress.personalStorage.toFixed(1)} ml</div>
                    </div>
                    <div class="storage-item">
                        <label>Global Storage:</label>
                        <div class="storage-amount">${globalStorage.toFixed(1)} ml</div>
                    </div>
                </div>
                ` : '<div class="no-character">No character selected</div>'}
            </div>
        `;

        document.body.appendChild(panel);
        return panel;
    }

    update() {
        if (!this.domElement) return;

        const progress = this.manager.getProgress();
        const state = this.manager.state;
        const capacity = this.manager.getMilkCapacity();
        const globalStorage = this.manager.getGlobalStorage();

        // Update milk display
        const milkBar = this.domElement.querySelector('.milk-bar');
        const milkText = this.domElement.querySelector('.milk-text');
        if (milkBar && milkText) {
            milkBar.style.width = `${progress.milkPercent}%`;
            milkText.textContent = `${state.currentMilk.toFixed(1)}/${capacity.toFixed(1)} ml`;
        }

        // Update EXP display
        const expBar = this.domElement.querySelector('.exp-bar');
        const expText = this.domElement.querySelector('.exp-text');
        if (expBar && expText) {
            expBar.style.width = `${progress.expPercent}%`;
            expText.textContent = `Level ${state.level} (${state.exp}/${progress.nextLevelExp} EXP)`;
        }

        // Update storage displays
        const personalStorage = this.domElement.querySelector('.storage-item:first-child .storage-amount');
        const globalStorageEl = this.domElement.querySelector('.storage-item:last-child .storage-amount');
        if (personalStorage) {
            personalStorage.textContent = `${progress.personalStorage.toFixed(1)} ml`;
        }
        if (globalStorageEl) {
            globalStorageEl.textContent = `${globalStorage.toFixed(1)} ml`;
        }
    }

    sendSystemMessage(message) {
        try {
            const chatInput = document.getElementById('send_textarea');
            if (!chatInput) return;

            chatInput.value = `/sys compact=true ${message}`;

            const sendButton = document.querySelector('#send_but');
            if (sendButton) {
                sendButton.click();
            } else {
                const event = new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    bubbles: true
                });
                chatInput.dispatchEvent(event);
            }
        } catch (error) {
            console.error("Failed to send system message:", error);
        }
    }

    toggle() {
        this.isVisible ? this.hide() : this.show();
    }

    show() {
        if (!this.domElement) {
            this.domElement = this.createPanel();
            this.makeDraggable(this.domElement);
            this.attachEventListeners();
        }

        this.domElement.style.display = 'block';
        this.update();
        this.isVisible = true;
    }

    hide() {
        if (this.domElement) {
            this.domElement.style.display = 'none';
        }
        this.isVisible = false;
    }

    attachEventListeners() {
        // Enable/disable toggle
        this.domElement.querySelector('#lactation-enabled')?.addEventListener('change', (e) => {
            const message = e.target.checked ?
                this.manager.enableLactation() :
                this.manager.disableLactation();

            if (extension_settings.lactation_system?.enableSysMessages) {
                this.sendSystemMessage(message);
            }
            this.update();
        });

        // Breast size selector
        this.domElement.querySelector('#breast-size-select')?.addEventListener('change', (e) => {
            const message = this.manager.setBreastSize(e.target.value);
            if (extension_settings.lactation_system?.enableSysMessages) {
                this.sendSystemMessage(message);
            }
            this.update();
        });

        // Destination selector
        this.domElement.querySelector('#destination-select')?.addEventListener('change', (e) => {
            const message = this.manager.setDestination(e.target.value);
            if (extension_settings.lactation_system?.enableSysMessages) {
                this.sendSystemMessage(message);
            }
            this.update();
        });

        // Milking actions
        const buttons = this.domElement.querySelectorAll('.milking-action');
        buttons.forEach(button => {
            button.addEventListener('click', () => {
                const method = button.dataset.method;
                const result = this.manager.milk(method);

                if (result.amount > 0 && extension_settings.lactation_system?.enableSysMessages) {
                    this.sendSystemMessage(result.message);
                } else if (result.message && result.amount === 0) {
                    toastr.info(result.message, "Cannot Milk");
                }

                this.update();
            });
        });

        // Refresh button
        const refreshBtn = this.domElement.querySelector('#lactation-refresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.manager.loadState();
                toastr.success("Lactation state reloaded", "Refresh Complete");
                this.update();
            });
        }

        // Close button
        const closeBtn = this.domElement.querySelector('#lactation-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }
    }

    updateCharacter(name) {
        if (!this.domElement) return;

        const header = this.domElement.querySelector('.lactation-header h3');
        if (header) header.textContent = `Lactation System - ${name}`;
        this.update();
    }

    makeDraggable(element) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        const header = element.querySelector('.lactation-header');

        if (header) {
            header.onmousedown = dragMouseDown;
        }

        function dragMouseDown(e) {
            e = e || window.event;
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }
}
