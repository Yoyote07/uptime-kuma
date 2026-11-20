<template>
    <div :class="classes">
        <div v-if="!$root.socket.connected && !$root.socket.firstConnect" class="lost-connection">
            <div class="container-fluid">
                {{ $root.connectionErrorMsg }}
                <div v-if="$root.showReverseProxyGuide">
                    {{ $t("Using a Reverse Proxy?") }}
                    <a href="https://github.com/louislam/uptime-kuma/wiki/Reverse-Proxy" target="_blank">
                        {{ $t("Check how to config it for WebSocket") }}
                    </a>
                </div>
            </div>
        </div>

        <!-- Barre de navigation en haut (PC et téléphone) — Sentinelle -->
        <nav v-if="$root.loggedIn" class="vigie-topbar">
            <router-link to="/dashboard" class="vigie-brand-top">
                <span class="vigie-logo"><font-awesome-icon icon="heartbeat" /></span>
                <span>Sentinelle</span>
            </router-link>

            <div class="vigie-links">
                <router-link
                    v-for="item in sideNav"
                    :key="item.to"
                    :to="item.to"
                    class="vigie-nav"
                    :class="{ on: isSideActive(item) }"
                >
                    <font-awesome-icon :icon="item.icon" />
                    <span class="vigie-label">{{ item.label }}</span>
                </router-link>
                <router-link
                    to="/settings/general"
                    class="vigie-nav"
                    :class="{ on: $route.path.startsWith('/settings') }"
                >
                    <font-awesome-icon icon="cog" />
                    <span class="vigie-label">{{ $t("Settings") }}</span>
                </router-link>
            </div>

            <div class="vigie-top-right">
                <a
                    v-if="hasNewVersion"
                    target="_blank"
                    href="https://github.com/louislam/uptime-kuma/releases"
                    class="vigie-nav vigie-update"
                    :title="$t('New Update')"
                >
                    <font-awesome-icon icon="arrow-alt-circle-up" />
                </a>
                <button
                    v-if="$root.socket.token !== 'autoLogin'"
                    class="vigie-user"
                    type="button"
                    :title="$t('Logout')"
                    @click="$root.logout"
                >
                    <span class="vigie-avatar">{{ $root.usernameFirstChar }}</span>
                    <span class="vigie-user-text">
                        <span class="vigie-user-name">{{ $root.username || "Compte" }}</span>
                        <span class="vigie-user-action">{{ $t("Logout") }}</span>
                    </span>
                </button>
            </div>
        </nav>

        <main :class="{ 'vigie-main': $root.loggedIn }">
            <router-view v-if="$root.loggedIn" />
            <Login v-if="!$root.loggedIn && $root.allowLoginDialog" />
        </main>

        <button
            v-if="numActiveToasts != 0"
            type="button"
            class="btn btn-normal clear-all-toast-btn"
            @click="clearToasts"
        >
            <font-awesome-icon icon="times" />
        </button>
    </div>
</template>

<script>
import Login from "../components/Login.vue";
import compareVersions from "compare-versions";
import { useToast } from "vue-toastification";
const toast = useToast();

export default {
    components: {
        Login,
    },

    data() {
        return {
            toastContainer: null,
            numActiveToasts: 0,
            toastContainerObserver: null,
        };
    },

    computed: {
        /**
         * Entrées de la barre latérale
         * @returns {object[]} liens de navigation
         */
        sideNav() {
            return [
                { to: "/dashboard", icon: "th-large", label: "Vue d'ensemble", match: ["/dashboard", "/list"] },
                { to: "/add", icon: "plus", label: "Ajouter une sonde", match: ["/add", "/clone", "/edit"] },
                { to: "/alertes", icon: "bell", label: "Alertes", match: ["/alertes"] },
                { to: "/maintenance", icon: "wrench", label: this.$t("Maintenance"), match: ["/maintenance", "/add-maintenance"] },
                { to: "/manage-status-page", icon: "stream", label: this.$t("Status Pages"), match: ["/manage-status-page", "/add-status-page"] },
            ];
        },

        // Theme or Mobile
        classes() {
            const classes = {};
            classes[this.$root.theme] = true;
            classes["mobile"] = this.$root.isMobile;
            return classes;
        },

        hasNewVersion() {
            if (this.$root.info.latestVersion && this.$root.info.version) {
                return compareVersions(this.$root.info.latestVersion, this.$root.info.version) >= 1;
            } else {
                return false;
            }
        },
    },

    watch: {},

    mounted() {
        this.toastContainer = document.querySelector(".bottom-right.toast-container");

        // Watch the number of active toasts
        this.toastContainerObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === "childList") {
                    this.numActiveToasts = mutation.target.children.length;
                }
            }
        });

        if (this.toastContainer != null) {
            this.toastContainerObserver.observe(this.toastContainer, { childList: true });
        }
    },

    beforeUnmount() {
        this.toastContainerObserver.disconnect();
    },

    methods: {
        /**
         * La page actuelle correspond-elle à cette entrée de la barre latérale ?
         * @param {object} item entrée de navigation
         * @returns {boolean} vrai si active
         */
        isSideActive(item) {
            return item.match.some((prefix) => this.$route.path.startsWith(prefix));
        },

        /**
         * Clear all toast notifications.
         * @returns {void}
         */
        clearToasts() {
            toast.clear();
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.nav-link {
    &:hover {
        background-color: $primary;
        color: #fff;

        .dark & {
            background-color: $primary;
            color: #000;
        }

        &.active {
            background-color: $highlight;
        }
    }

    &.status-page {
        background-color: rgba(255, 255, 255, 0.1);
    }
}

.bottom-nav {
    z-index: 1000;
    position: fixed;
    bottom: 0;
    height: calc(60px + env(safe-area-inset-bottom));
    width: 100%;
    left: 0;
    background-color: #fff;
    box-shadow:
        0 15px 47px 0 rgba(0, 0, 0, 0.05),
        0 5px 14px 0 rgba(0, 0, 0, 0.05);
    text-align: center;
    white-space: nowrap;
    padding: 0 10px env(safe-area-inset-bottom);

    a {
        text-align: center;
        width: 25%;
        display: inline-block;
        height: 100%;
        padding: 8px 10px 0;
        font-size: 13px;
        color: #c1c1c1;
        overflow: hidden;
        text-decoration: none;

        &.router-link-exact-active,
        &.active {
            color: $primary;
            font-weight: bold;
        }

        div {
            font-size: 20px;
        }
    }
}

main {
    min-height: calc(100vh - 160px);
}

.title {
    font-weight: bold;
}

.nav {
    margin-right: 25px;
}

.lost-connection {
    padding: 5px;
    background-color: crimson;
    color: white;
    position: fixed;
    width: 100%;
    z-index: 99999;
}

// Profile Pic Button with Dropdown
.dropdown-profile-pic {
    user-select: none;

    .nav-link {
        cursor: pointer;
        display: flex;
        gap: 6px;
        align-items: center;
        background-color: rgba(200, 200, 200, 0.2);
        padding: 0.5rem 0.8rem;

        &:hover {
            background-color: rgba(255, 255, 255, 0.2);
        }
    }

    .dropdown-menu {
        transition: all 0.2s;
        padding-left: 0;
        padding-bottom: 0;
        margin-top: 8px !important;
        border-radius: 16px;
        overflow: hidden;

        .dropdown-divider {
            margin: 0;
            border-top: 1px solid rgba(0, 0, 0, 0.4);
            background-color: transparent;
        }

        .dropdown-item-text {
            font-size: 14px;
            padding-bottom: 0.7rem;
        }

        .dropdown-item {
            padding: 0.7rem 1rem;
        }

        .dark & {
            background-color: $dark-bg;
            color: $dark-font-color;
            border-color: $dark-border-color;

            .dropdown-item {
                color: $dark-font-color;

                &.active {
                    color: $dark-font-color2;
                    background-color: $highlight !important;
                }

                &:hover {
                    background-color: $dark-bg2;
                }
            }
        }
    }

    .profile-pic {
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        background-color: $primary;
        width: 24px;
        height: 24px;
        margin-right: 5px;
        border-radius: 50rem;
        font-weight: bold;
        font-size: 10px;
    }
}

.dark {
    header {
        background-color: $dark-header-bg;
        border-bottom-color: $dark-header-bg !important;

        span {
            color: #f0f6fc;
        }
    }

    .bottom-nav {
        background-color: $dark-bg;
    }
}

.clear-all-toast-btn {
    position: fixed;
    right: 1em;
    bottom: 1em;
    font-size: 1.2em;
    padding: 9px 15px;
    width: 48px;
    box-shadow: 2px 2px 30px rgba(0, 0, 0, 0.2);
    z-index: 100;

    .dark & {
        box-shadow: 2px 2px 30px rgba(0, 0, 0, 0.5);
    }
}

@media (max-width: 770px) {
    .clear-all-toast-btn {
        bottom: 72px;
    }
}
</style>
