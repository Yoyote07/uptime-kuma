<template>
    <!-- Carte d'une sonde (Vue d'ensemble Vigie) -->
    <router-link :to="`/dashboard/${monitor.id}`" class="vigie-card" :class="`is-${state.key}`">
        <div class="vigie-card-head">
            <div class="vigie-card-avatar">{{ initial }}</div>
            <div class="vigie-card-title">
                <div class="vigie-card-name">{{ monitor.name }}</div>
                <div class="vigie-card-state">
                    <span class="vigie-dot" />
                    {{ state.label }}
                </div>
            </div>
            <div class="vigie-card-uptime">
                <div class="value">{{ uptimeText }}</div>
                <div class="unit">{{ pingText }}</div>
            </div>
        </div>

        <!-- Un seul visuel : le graphique si la sonde mesure un temps de réponse, sinon l'historique -->
        <PingSparkline v-if="hasPing" :monitor-id="monitor.id" :show-value="false" :smooth="true" />
        <div v-else class="vigie-beats">
            <i v-for="n in emptyBeats" :key="`e${n}`" class="empty" />
            <i v-for="(beat, index) in recentBeats" :key="index" :class="`s${beat.status}`" />
        </div>
    </router-link>
</template>

<script>
import PingSparkline from "./PingSparkline.vue";
import { UP, DOWN, PENDING, MAINTENANCE } from "../util.ts";

const BEATS_SHOWN = 40;

const TYPE_LABELS = {
    http: "HTTP",
    keyword: "HTTP · mot-clé",
    "json-query": "HTTP · JSON",
    port: "Port",
    ping: "Ping",
    docker: "Docker",
    push: "Push",
    dns: "DNS",
    group: "Groupe",
};

export default {
    components: {
        PingSparkline,
    },

    props: {
        /** Sonde à afficher (élément de $root.monitorList) */
        monitor: {
            type: Object,
            required: true,
        },
    },

    computed: {
        initial() {
            return (this.monitor.name || "?").charAt(0).toUpperCase();
        },

        typeLabel() {
            return TYPE_LABELS[this.monitor.type] || this.monitor.type;
        },

        beats() {
            return this.$root.heartbeatList[this.monitor.id] || [];
        },

        recentBeats() {
            return this.beats.slice(-BEATS_SHOWN);
        },

        emptyBeats() {
            return Math.max(0, BEATS_SHOWN - this.recentBeats.length);
        },

        hasPing() {
            return this.beats.filter((beat) => typeof beat.ping === "number").length >= 2;
        },

        /**
         * État affiché de la sonde
         * @returns {{key: string, label: string}} clé CSS et libellé
         */
        state() {
            if (!this.monitor.active) {
                return { key: "paused", label: "En pause" };
            }
            const last = this.beats[this.beats.length - 1];
            if (!last) {
                return { key: "unknown", label: "En attente" };
            }
            switch (last.status) {
                case UP:
                    return { key: "up", label: "Opérationnel" };
                case DOWN:
                    return { key: "down", label: "Hors service" };
                case PENDING:
                    return { key: "pending", label: "Instable" };
                case MAINTENANCE:
                    return { key: "maintenance", label: "Maintenance" };
                default:
                    return { key: "unknown", label: "Inconnu" };
            }
        },

        pingText() {
            const pings = this.beats.filter((beat) => typeof beat.ping === "number");
            return pings.length ? `${pings[pings.length - 1].ping} ms` : "24 h";
        },

        uptimeText() {
            const uptime = this.$root.uptimeList[`${this.monitor.id}_24`];
            if (typeof uptime !== "number") {
                return "–";
            }
            const percent = uptime * 100;
            return `${percent === 100 ? "100" : percent.toFixed(1).replace(".", ",")} %`;
        },
    },
};
</script>
