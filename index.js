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

        function getCurrentCharacter() {
            const context = getContext();
            return context.characters[context.characterId] || null;
        }

        function updateCharacter() {
            try {
                const character = getCurrentCharacter();
                if (!character) {
                    console.log("[LactationSystem] No character selected");
                    return;
                }

                manager.setCharacter(character);
                panel.updateCharacter(character.name);
                console.log(`[LactationSystem] Character set: ${character.name}`);

                // DEBUG: Show character data in console
                console.log("[LactationSystem] Character data:", character);
            } catch (error) {
                console.error("[LactationSystem] Character update failed", error);
            }
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

        function setupEventListeners() {
            try {
                const { eventSource, event_types } = getContext();

                // Update character on relevant events
                eventSource.on(event_types.CHAT_CHANGED, updateCharacter);
                eventSource.on(event_types.CHARACTER_CHANGED, updateCharacter);

                // Use APP_READY for initial load
                eventSource.on(event_types.APP_READY, updateCharacter);

                // Milk production
                eventSource.on(event_types.GENERATION_ENDED, (data) => {
                    console.log("[LactationSystem] GENERATION_ENDED event received");
                    if (data.success) {
                        const character = getCurrentCharacter();
                        if (character) {
                            const sysMessage = manager.produceMilk();
                            if (sysMessage && extension_settings[MODULE_NAME]?.enableSysMessages) {
                                panel.sendSystemMessage(sysMessage);
                            }
                            panel.update();
                        }
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
                    milkPerMessage: 10,
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
        createSettingsUI();

        // Initialize immediately
        updateCharacter();

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
