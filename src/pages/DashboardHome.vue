<template>
    <transition ref="tableContainer" name="slide-fade" appear>
        <div v-if="$route.name === 'DashboardHome'">
            <!-- ===== Vue d'ensemble Vigie ===== -->
            <div class="vigie-top">
                <div>
                    <h1 class="vigie-h1">Vue d'ensemble</h1>
                    <div class="vigie-sub">
                        {{ $root.stats.up }} / {{ $root.stats.active }} en ligne · {{ averageUptime }} sur 24 h ·
                        {{ averagePing }} de temps de réponse moyen
                    </div>
                </div>
                <span class="vigie-pill" :class="{ bad: $root.stats.down > 0 }">
                    <b />
                    {{
                        $root.stats.down > 0
                            ? `${$root.stats.down} sonde${$root.stats.down > 1 ? "s" : ""} en panne`
                            : "Tout fonctionne"
                    }}
                </span>
                <div class="vigie-top-actions">
                    <input v-model="search" class="vigie-search" type="search" placeholder="Rechercher une sonde…" />
                    <router-link to="/add" class="btn btn-primary">
                        <font-awesome-icon icon="plus" />
                        Nouvelle sonde
                    </router-link>
                </div>
            </div>

            <div class="vigie-grid">
                <VigieMonitorCard v-for="monitor in filteredMonitors" :key="monitor.id" :monitor="monitor" />
                <div v-if="filteredMonitors.length === 0" class="vigie-empty">Aucune sonde ne correspond.</div>
            </div>

            <section class="vigie-events">
                <div class="vigie-events-head">
                    <h2 class="vigie-section">Événements importants</h2>
                    <button
                        v-if="importantHeartBeatListLength > 0"
                        class="btn btn-sm btn-outline-danger"
                        :disabled="clearingAllEvents"
                        @click="clearAllEventsDialog"
                    >
                        Tout effacer
                    </button>
                </div>

                <div v-if="importantHeartBeatListLength === 0" class="vigie-events-empty">
                    Aucun événement important : rien n'est tombé récemment.
                </div>

                <ul v-else class="vigie-events-list">
                    <li v-for="(beat, index) in displayedRecords" :key="index" :class="`s${beat.status}`">
                        <span class="vigie-dot" />
                        <router-link :to="`/dashboard/${beat.monitorID}`" class="ev-name">
                            {{ $root.monitorList[beat.monitorID]?.name }}
                        </router-link>
                        <span class="ev-state">{{ eventLabel(beat.status) }}</span>
                        <span class="ev-time"><Datetime :value="beat.time" /></span>
                        <span class="ev-msg" :title="beat.msg">{{ beat.msg }}</span>
                    </li>
                </ul>

                <div v-if="importantHeartBeatListLength > perPage" class="d-flex justify-content-center kuma_pagination">
                    <pagination
                        v-model="page"
                        :records="importantHeartBeatListLength"
                        :per-page="perPage"
                        :options="paginationConfig"
                    />
                </div>
            </section>
        </div>
    </transition>
    <Confirm
        ref="confirmClearEvents"
        btn-style="btn-danger"
        :yes-text="$t('Yes')"
        :no-text="$t('No')"
        @yes="clearAllEvents"
    >
        {{ $t("clearAllEventsMsg") }}
    </Confirm>
    <router-view ref="child" />
</template>

<script>
import Status from "../components/Status.vue";
import Datetime from "../components/Datetime.vue";
import Pagination from "v-pagination-3";
import Confirm from "../components/Confirm.vue";
import VigieMonitorCard from "../components/VigieMonitorCard.vue";
import { UP, DOWN, PENDING, MAINTENANCE } from "../util.ts";
import { formatMs, formatPercent } from "../sentinelle-format.js";

export default {
    components: {
        Datetime,
        Status,
        Pagination,
        Confirm,
        VigieMonitorCard,
    },
    props: {
        calculatedHeight: {
            type: Number,
            default: 0,
        },
    },
    data() {
        return {
            page: 1,
            perPage: 25,
            initialPerPage: 25,
            paginationConfig: {
                hideCount: true,
                chunksNavigation: "scroll",
            },
            importantHeartBeatListLength: 0,
            displayedRecords: [],
            clearingAllEvents: false,
            search: "",
            activeFilter: "all",
        };
    },
    computed: {
        /**
         * Sondes affichées en cartes (les groupes sont exclus, leurs sondes enfants sont affichées)
         * @returns {object[]} sondes triées par nom
         */
        cardMonitors() {
            return Object.values(this.$root.monitorList)
                .filter((monitor) => monitor.type !== "group")
                .sort((a, b) => a.name.localeCompare(b.name));
        },

        /**
         * Filtres rapides avec leur compteur
         * @returns {object[]} filtres
         */
        filters() {
            const count = (key) => this.cardMonitors.filter((m) => this.matchesFilter(m, key)).length;
            return [
                { key: "all", label: "Toutes", count: count("all") },
                { key: "up", label: "En ligne", count: count("up") },
                { key: "down", label: "En panne", count: count("down") },
                { key: "paused", label: "En pause", count: count("paused") },
            ];
        },

        filteredMonitors() {
            const query = this.search.trim().toLowerCase();
            const isDown = (monitor) => this.matchesFilter(monitor, "down");
            return this.cardMonitors
                .filter((monitor) => !query || monitor.name.toLowerCase().includes(query))
                .sort((a, b) => isDown(b) - isDown(a));
        },

        /**
         * Sondes comptées dans les moyennes : actives, et dont le dernier état est connu
         * (opérationnelle ou en panne). Les sondes en pause, en attente ou en maintenance
         * ne faussent pas le résultat.
         * @returns {object[]} sondes comptées
         */
        countedMonitors() {
            return this.cardMonitors.filter((monitor) => {
                const last = this.$root.lastHeartbeatList[monitor.id];
                return monitor.active && last && (last.status === UP || last.status === DOWN);
            });
        },

        averageUptime() {
            const values = this.countedMonitors
                .map((monitor) => this.$root.uptimeList[`${monitor.id}_24`])
                .filter((value) => typeof value === "number");
            if (values.length === 0) {
                return "–";
            }
            return formatPercent(values.reduce((a, b) => a + b, 0) / values.length);
        },

        averagePing() {
            const values = this.countedMonitors
                .map((monitor) => this.$root.avgPingList[monitor.id])
                .filter((value) => typeof value === "number" && value > 0);
            if (values.length === 0) {
                return "–";
            }
            return formatMs(values.reduce((a, b) => a + b, 0) / values.length);
        },

        showGroupColumn() {
            return Object.values(this.$root.monitorList).some((m) => m.parent != null);
        },
        tableColumnCount() {
            return this.showGroupColumn ? 5 : 4;
        },
    },
    watch: {
        perPage() {
            this.$nextTick(() => {
                this.getImportantHeartbeatListPaged();
            });
        },

        page() {
            this.getImportantHeartbeatListPaged();
        },
    },

    mounted() {
        this.getImportantHeartbeatListLength();

        this.$root.emitter.on("newImportantHeartbeat", this.onNewImportantHeartbeat);

        this.initialPerPage = this.perPage;

        window.addEventListener("resize", this.updatePerPage);
        this.updatePerPage();
    },

    beforeUnmount() {
        this.$root.emitter.off("newImportantHeartbeat", this.onNewImportantHeartbeat);

        window.removeEventListener("resize", this.updatePerPage);
    },

    methods: {
        /**
         * Libellé court d'un événement
         * @param {number} status état du battement
         * @returns {string} libellé
         */
        eventLabel(status) {
            return { [DOWN]: "Panne", [UP]: "Rétabli", [PENDING]: "Instable", [MAINTENANCE]: "Maintenance" }[status] || "—";
        },

        /**
         * La sonde correspond-elle au filtre ?
         * @param {object} monitor sonde
         * @param {string} key all | up | down | paused
         * @returns {boolean} vrai si elle correspond
         */
        matchesFilter(monitor, key) {
            if (key === "all") {
                return true;
            }
            if (key === "paused") {
                return !monitor.active;
            }
            const last = this.$root.lastHeartbeatList[monitor.id];
            if (!monitor.active || !last) {
                return false;
            }
            return key === "up" ? last.status === UP : last.status === DOWN;
        },

        /**
         * Returns the group (parent) name for a monitor, or empty string if none.
         * @param {number} monitorID - The monitor ID.
         * @returns {string} The group name or empty string.
         */
        getGroupName(monitorID) {
            const monitor = this.$root.monitorList[monitorID];
            if (!monitor || monitor.parent == null) {
                return "";
            }
            const parent = this.$root.monitorList[monitor.parent];
            return parent ? parent.name : "";
        },

        /**
         * Returns the group (parent) ID for a monitor, or null if none.
         * @param {number} monitorID - The monitor ID.
         * @returns {number|null} The group monitor ID or null.
         */
        getGroupId(monitorID) {
            const monitor = this.$root.monitorList[monitorID];
            return monitor && monitor.parent != null ? monitor.parent : null;
        },

        /**
         * Updates the displayed records when a new important heartbeat arrives.
         * @param {object} heartbeat - The heartbeat object received.
         * @returns {void}
         */
        onNewImportantHeartbeat(heartbeat) {
            if (this.page === 1) {
                this.displayedRecords.unshift(heartbeat);
                if (this.displayedRecords.length > this.perPage) {
                    this.displayedRecords.pop();
                }
                this.importantHeartBeatListLength += 1;
            }
        },

        /**
         * Retrieves the length of the important heartbeat list for all monitors.
         * @returns {void}
         */
        getImportantHeartbeatListLength() {
            this.$root.getSocket().emit("monitorImportantHeartbeatListCount", null, (res) => {
                if (res.ok) {
                    this.importantHeartBeatListLength = res.count;
                    this.getImportantHeartbeatListPaged();
                }
            });
        },

        /**
         * Retrieves the important heartbeat list for the current page.
         * @returns {void}
         */
        getImportantHeartbeatListPaged() {
            const offset = (this.page - 1) * this.perPage;
            this.$root.getSocket().emit("monitorImportantHeartbeatListPaged", null, offset, this.perPage, (res) => {
                if (res.ok) {
                    this.displayedRecords = res.data;
                }
            });
        },

        /**
         * Updates the number of items shown per page based on the available height.
         * @returns {void}
         */
        updatePerPage() {
            const tableContainer = this.$refs.tableContainer;
            const tableContainerHeight = tableContainer.offsetHeight;
            const availableHeight = window.innerHeight - tableContainerHeight;
            const additionalPerPage = Math.floor(availableHeight / 58);

            if (additionalPerPage > 0) {
                this.perPage = Math.max(this.initialPerPage, this.perPage + additionalPerPage);
            } else {
                this.perPage = this.initialPerPage;
            }
        },

        clearAllEventsDialog() {
            this.$refs.confirmClearEvents.show();
        },
        clearAllEvents() {
            this.clearingAllEvents = true;
            const monitorIDs = Object.keys(this.$root.monitorList);
            let failed = 0;
            const total = monitorIDs.length;

            if (total === 0) {
                this.clearingAllEvents = false;
                this.$root.toastError(this.$t("No monitors found"));
                return;
            }

            monitorIDs.forEach((monitorID) => {
                this.$root.getSocket().emit("clearEvents", monitorID, (res) => {
                    if (!res || !res.ok) {
                        failed++;
                    }
                });
            });
            this.clearingAllEvents = false;
            this.page = 1;
            this.getImportantHeartbeatListLength();
            if (failed === 0) {
                this.$root.toastSuccess(this.$t("Events cleared successfully"));
            } else {
                this.$root.toastError(
                    this.$t("Could not clear events", {
                        failed,
                        total,
                    })
                );
            }
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars";

.num {
    font-size: 30px;
    color: $primary;
    font-weight: bold;
    display: block;
}

.shadow-box {
    padding: 20px;
}

table {
    font-size: 14px;

    tr {
        transition: all ease-in-out 0.2ms;
    }

    @media (max-width: 550px) {
        table-layout: fixed;
        overflow-wrap: break-word;
    }
}

@media screen and (max-width: 1280px) {
    .name-column {
        min-width: 150px;
    }
}

@media screen and (min-aspect-ratio: 4/3) {
    .name-column {
        min-width: 200px;
    }
}

.table-wrapper {
    overflow-x: auto;
}
</style>
