import { getContext, extension_settings } from "../../../extensions.js";

console.log("[LactationSystem] Starting extension loading...");

try {
    async function initializeExtension() {
        console.log("[LactationSystem] Importing modules...");

        const { LactationManager } = await import("./src/LactationManager.js");
        const { LactationPanel } = await import("./src/LactationPanel.js");

        const MODULE_NAME = 'lactation_system';
        const manager = new LactationManager();
        const panel = new LactationPanel(manager);

        function getCharacterName() {
            const context = getContext();
            return context.characters[context.characterId]?.name || 'Unknown';
        }

        function registerLactationCommand() {
            try {
                const { registerSlashCommand } = SillyTavern.getContext();
                registerSlashCommand('lactation', () => panel.toggle(),
                    [], 'Toggle lactation system panel', true, true);
                console.log("[LactationSystem] Slash command registered");
            } catch (error) {
                console.error("[LactationSystem] Command registration failed", error);
            }
        }

        function updateForCurrentCharacter() {
            try {
                const charName = getCharacterName();
                manager.setCharacter(charName);
                panel.updateCharacter(charName);
                console.log(`[LactationSystem] Set character: ${charName}`);
            } catch (error) {
                console.error("[LactationSystem] Character update failed", error);
            }
        }

        function setupEventListeners() {
            try {
                const { eventSource, event_types } = getContext();
                eventSource.on(event_types.CHAT_CHANGED, updateForCurrentCharacter);
                eventSource.on(event_types.CHARACTER_CHANGED, updateForCurrentCharacter);
                // Milk production listener
                eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (data) => {
                    if (manager.character === data.name) {
                        const sysMessage = manager.produceMilk();
                        if (sysMessage && extension_settings[MODULE_NAME]?.enableSysMessages) {
                            panel.sendSystemMessage(sysMessage);
                        }
                        panel.update();
                    }
                });
                console.log("[LactationSystem] Event listeners set up");
            } catch (error) {
                console.error("[LactationSystem] Event listener setup failed", error);
            }
        }

        function initSettings() {
            if (!extension_settings[MODULE_NAME]) {
                extension_settings[MODULE_NAME] = {
                    autoOpen: false,
                    enableSysMessages: true,
                    milkPerMessage: 10, // Base ml produced per message
                };
            }
        }

        function createSettingsUI() {
            const settingsHtml = `
            <div class="lactation-extension-settings">
                <div class="inline-drawer">
                    <div class="inline-drawer-toggle inline-drawer-header">
                        <b>Lactation System Settings</b>
                        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                    </div>
                    <div class="inline-drawer-content">
                        <div class="flex-container">
                            <label for="lactation-sys-toggle">Enable system messages</label>
                            <input type="checkbox" id="lactation-sys-toggle"
                                   ${extension_settings[MODULE_NAME].enableSysMessages ? 'checked' : ''}>
                        </div>
                        <div class="flex-container">
                            <label for="lactation-milk-per-message">Milk per message (ml):</label>
                            <input type="number" id="lactation-milk-per-message" min="1" max="100"
                                   value="${extension_settings[MODULE_NAME].milkPerMessage}">
                        </div>
                    </div>
                </div>
            </div>
            `;

            $("#extensions_settings").append(settingsHtml);

            $("#lactation-sys-toggle").on("input", function() {
                extension_settings[MODULE_NAME].enableSysMessages = $(this).prop('checked');
                saveSettingsDebounced();
            });

            $("#lactation-milk-per-message").on("input", function() {
                const value = parseInt($(this).val());
                if (!isNaN(value)) {
                    extension_settings[MODULE_NAME].milkPerMessage = value;
                    saveSettingsDebounced();
                }
            });
        }

        initSettings();
        registerLactationCommand();
        setupEventListeners();
        updateForCurrentCharacter();
        createSettingsUI();

        if (extension_settings[MODULE_NAME].autoOpen) {
            setTimeout(() => panel.show(), 1000);
        }
    }

    $(async () => {
        try {
            await initializeExtension();
            console.log("[LactationSystem] Extension loaded successfully");
        } catch (error) {
            console.error("[LactationSystem] Initialization failed", error);
        }
    });
} catch (loadingError) {
    console.error("[LactationSystem] Critical loading error", loadingError);
}
