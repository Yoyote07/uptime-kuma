<template>
    <!-- Carte d'une sonde (Vue d'ensemble Vigie) -->
    <router-link :to="`/dashboard/${monitor.id}`" class="vigie-card" :class="`is-${state.key}`">
        <div class="vigie-card-head">
            <div class="vigie-card-avatar">{{ initial }}</div>
            <div class="vigie-card-title">
                <div class="vigie-card-name">{{ monitor.name }}</div>
                <div class="vigie-card-state">
                    <span class="vigie-dot" />
                    {{ state.label }}<template v-if="speed !== 'fast' && state.key === 'up'"> · {{ speed === "slow" ? "lent" : "très lent" }}</template>
                </div>
            </div>
            <div class="vigie-card-uptime">
                <div class="value">{{ uptimeText }}</div>
                <div class="unit">{{ pingText }}</div>
            </div>
        </div>

        <!-- Un seul visuel : le graphique si la sonde mesure un temps de réponse, sinon l'historique -->
        <PingSparkline v-if="hasPing" :monitor-id="monitor.id" :show-value="false" :smooth="true" :color="stateColor" />
        <div v-else class="vigie-beats" title="Dernières 24 h">
            <i v-for="n in emptyBeats" :key="`e${n}`" class="empty" />
            <i v-for="(beat, index) in recentBeats" :key="index" :class="`s${beat.status}`" />
        </div>
    </router-link>
</template>

<script>
import PingSparkline from "./PingSparkline.vue";
import { UP, DOWN, PENDING, MAINTENANCE } from "../util.ts";
import { formatMs, formatPercent } from "../sentinelle-format.js";

const BEATS_SHOWN = 40;

// Seuils de vitesse en ms (moyenne des 5 dernières mesures).
// Les sondes Push reçoivent un ping mesuré vers Internet (ex. latence Discord
// d'un bot), donc des seuils plus larges que pour les services du réseau local.
const SPEED_THRESHOLDS = {
    default: { slow: 100, verySlow: 300 },
    push: { slow: 300, verySlow: 600 },
};

const SPEED_COLORS = {
    fast: "#6fbfa3",
    slow: "#d9b46c",
    "very-slow": "#e0926c",
};

const STATE_COLORS = {
    up: "#6fbfa3",
    down: "#e06c75",
    pending: "#d9b46c",
    maintenance: "#8fa3d9",
    paused: "#8b93ad",
    unknown: "#8b93ad",
};

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

        /**
         * Battements des dernières 24 h seulement, pour que la barre corresponde au pourcentage 24 h
         * (une sonde Push vérifiée toutes les heures aurait sinon une barre couvrant plusieurs jours)
         * @returns {object[]} battements récents
         */
        recentBeats() {
            const since = Date.now() - 24 * 3600 * 1000;
            return this.beats
                .filter((beat) => {
                    const time = Date.parse(String(beat.time).replace(" ", "T") + "Z");
                    return Number.isNaN(time) || time >= since;
                })
                .slice(-BEATS_SHOWN);
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

        /**
         * Couleur de la courbe selon l'état : vert si tout va bien, rouge en panne…
         * @returns {string} couleur hexadécimale
         */
        stateColor() {
            if (this.state.key === "up") {
                return SPEED_COLORS[this.speed];
            }
            return STATE_COLORS[this.state.key] || STATE_COLORS.unknown;
        },

        /**
         * Vitesse récente : rapide, lente ou très lente
         * @returns {string} fast | slow | very-slow
         */
        speed() {
            const recent = this.beats
                .filter((beat) => typeof beat.ping === "number")
                .slice(-5)
                .map((beat) => beat.ping);
            if (recent.length === 0) {
                return "fast";
            }
            const average = recent.reduce((a, b) => a + b, 0) / recent.length;
            const limits = SPEED_THRESHOLDS[this.monitor.type] || SPEED_THRESHOLDS.default;
            if (average >= limits.verySlow) {
                return "very-slow";
            }
            return average >= limits.slow ? "slow" : "fast";
        },

        pingText() {
            const pings = this.beats.filter((beat) => typeof beat.ping === "number");
            return pings.length ? formatMs(pings[pings.length - 1].ping) : "24 h";
        },

        uptimeText() {
            return formatPercent(this.$root.uptimeList[`${this.monitor.id}_24`]);
        },
    },
};
</script>
