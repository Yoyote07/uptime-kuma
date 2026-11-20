<template>
    <div>
        <div v-if="false" class="shadow-box mb-3">
            <router-link to="/manage-status-page" class="nav-link">
                <font-awesome-icon icon="stream" />
                {{ $t("Status Pages") }}
            </router-link>
            <router-link to="/maintenance" class="nav-link">
                <font-awesome-icon icon="wrench" />
                {{ $t("Maintenance") }}
            </router-link>
        </div>

        <div class="vigie-top">
            <div>
                <h1 class="vigie-h1">Paramètres</h1>
                <div class="vigie-sub">Réglages de Sentinelle</div>
            </div>
        </div>

        <div class="sentinelle-settings" :class="{ 'has-page': !!currentPage }">
            <nav v-if="showSubMenu" class="sentinelle-settings-menu">
                <router-link
                    v-for="key in mainKeys"
                    :key="key"
                    :to="`/settings/${key}`"
                    class="sentinelle-settings-item"
                >
                    {{ subMenus[key].title }}
                </router-link>

                <button
                    type="button"
                    class="sentinelle-settings-group"
                    :aria-expanded="advancedOpen"
                    @click="advancedOpen = !advancedOpen"
                >
                    <span>Avancé</span>
                    <font-awesome-icon :icon="advancedOpen ? 'chevron-up' : 'chevron-down'" />
                </button>
                <template v-if="advancedOpen">
                    <router-link
                        v-for="key in advancedKeys"
                        :key="key"
                        :to="`/settings/${key}`"
                        class="sentinelle-settings-item sub"
                    >
                        {{ subMenus[key].title }}
                    </router-link>
                </template>

                <router-link to="/settings/about" class="sentinelle-settings-item about">À propos</router-link>
            </nav>

            <section v-if="currentPage" class="sentinelle-settings-content">
                <router-link v-if="$root.isMobile" to="/settings" class="vigie-back">← Paramètres</router-link>
                <h2 class="sentinelle-settings-title">{{ subMenus[currentPage]?.title }}</h2>
                <router-view v-slot="{ Component }">
                    <transition name="slide-fade" appear>
                        <component :is="Component" />
                    </transition>
                </router-view>
            </section>
        </div>
    </div>
</template>

<script>
import { useRoute } from "vue-router";

export default {
    data() {
        return {
            advancedOpen: false,
            show: true,
            settings: {},
            settingsLoaded: false,
        };
    },

    computed: {
        currentPage() {
            let pathSplit = useRoute().path.split("/");
            let pathEnd = pathSplit[pathSplit.length - 1];
            if (!pathEnd || pathEnd === "settings") {
                return null;
            }
            return pathEnd;
        },

        showSubMenu() {
            if (this.$root.isMobile) {
                return !this.currentPage;
            } else {
                return true;
            }
        },

        subMenus() {
            return {
                general: { title: "Général" },
                appearance: { title: "Apparence" },
                security: { title: "Sécurité" },
                notifications: { title: "Messages et expirations" },
                tags: { title: "Étiquettes" },
                "monitor-history": { title: "Historique des sondes" },
                "reverse-proxy": { title: "Proxy inverse" },
                "docker-hosts": { title: "Hôtes Docker" },
                "remote-browsers": { title: "Navigateurs distants" },
                "api-keys": { title: "Clés API" },
                proxies: { title: "Proxys" },
                about: { title: "À propos" },
            };
        },

        /** Rubriques affichées directement */
        mainKeys() {
            return ["general", "appearance", "security", "notifications", "tags", "monitor-history"];
        },

        /** Rubriques peu utilisées, regroupées sous « Avancé » */
        advancedKeys() {
            return ["reverse-proxy", "docker-hosts", "remote-browsers", "api-keys", "proxies"];
        },
    },

    watch: {
        "$root.isMobile"() {
            this.loadGeneralPage();
        },
    },

    mounted() {
        this.loadSettings();
        this.loadGeneralPage();
        this.advancedOpen = this.advancedKeys.includes(this.currentPage);
    },

    methods: {
        /**
         * Load the general settings page
         * For desktop only, on mobile do nothing
         * @returns {void}
         */
        loadGeneralPage() {
            if (!this.currentPage && !this.$root.isMobile) {
                this.$router.push("/settings/general");
            }
        },

        /**
         * Load settings from server
         * @returns {void}
         */
        loadSettings() {
            this.$root.getSocket().emit("getSettings", (res) => {
                this.settings = res.data;

                if (this.settings.checkUpdate === undefined) {
                    this.settings.checkUpdate = true;
                }

                if (this.settings.searchEngineIndex === undefined) {
                    this.settings.searchEngineIndex = false;
                }

                if (this.settings.entryPage === undefined) {
                    this.settings.entryPage = "dashboard";
                }

                if (this.settings.nscd === undefined) {
                    this.settings.nscd = true;
                }

                if (this.settings.keepDataPeriodDays === undefined) {
                    this.settings.keepDataPeriodDays = 180;
                }

                if (this.settings.tlsExpiryNotifyDays === undefined) {
                    this.settings.tlsExpiryNotifyDays = [7, 14, 21];
                }

                if (this.settings.domainExpiryNotifyDays === undefined) {
                    this.settings.domainExpiryNotifyDays = [7, 14, 21];
                }

                if (this.settings.trustProxy === undefined) {
                    this.settings.trustProxy = false;
                }

                this.settingsLoaded = true;
            });
        },

        /**
         * Callback for saving settings
         * @callback saveSettingsCB
         * @param {object} res Result of operation
         * @returns {void}
         */

        /**
         * Save Settings
         * @param {saveSettingsCB} callback Callback for socket response
         * @param {string} currentPassword Only need for disableAuth to true
         * @returns {void}
         */
        saveSettings(callback, currentPassword) {
            let valid = this.validateSettings();
            if (valid.success) {
                this.$root.getSocket().emit("setSettings", this.settings, currentPassword, (res) => {
                    this.$root.toastRes(res);
                    this.loadSettings();

                    if (callback) {
                        callback();
                    }
                });
            } else {
                this.$root.toastError(valid.msg);
            }
        },

        /**
         * Ensure settings are valid
         * @returns {object} Contains success state and error msg
         */
        validateSettings() {
            if (this.settings.keepDataPeriodDays < 0) {
                return {
                    success: false,
                    msg: this.$t("dataRetentionTimeError"),
                };
            }
            return {
                success: true,
                msg: "",
            };
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.sentinelle-settings {
    display: grid;
    grid-template-columns: 250px minmax(0, 1fr);
    gap: 14px;
    align-items: start;
}

.sentinelle-settings-menu,
.sentinelle-settings-content {
    border-radius: 16px;
    background: rgba(17, 24, 45, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(16px) saturate(140%);
    -webkit-backdrop-filter: blur(16px) saturate(140%);
}

.sentinelle-settings-menu {
    position: sticky;
    top: 100px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.sentinelle-settings-item {
    display: block;
    padding: 9px 14px;
    border-radius: 11px;
    font-size: 14.5px;
    color: #8b93ad !important;
    text-decoration: none;

    &:hover {
        background: rgba(255, 255, 255, 0.05);
        color: #e6e9f5 !important;
    }

    &.router-link-active {
        background: rgba(143, 163, 217, 0.15);
        color: #e6e9f5 !important;
        box-shadow: inset 3px 0 0 #8fa3d9;
    }

    &.sub {
        padding-left: 26px;
        font-size: 14px;
    }

    &.about {
        margin-top: 8px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 0 0 11px 11px;
        padding-top: 12px;
    }
}

.sentinelle-settings-group {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;
    padding: 9px 14px;
    border: none;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    background: transparent;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: #8b93ad;

    &:hover {
        color: #e6e9f5;
    }
}

.sentinelle-settings-content {
    padding: 22px 26px 26px;
    min-width: 0;
}

.sentinelle-settings-title {
    font-size: 20px;
    font-weight: 600;
    margin: 0 0 18px;
    padding-bottom: 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

// Téléphone : le menu seul, puis la page choisie seule
@media (max-width: 900px) {
    .sentinelle-settings {
        grid-template-columns: 1fr;
    }

    .sentinelle-settings-menu {
        position: static;
    }

    .sentinelle-settings-content {
        padding: 16px;
    }
}
</style>
