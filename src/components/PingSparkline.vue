<template>
    <!-- Mini graphique du temps de réponse (thème homelab) -->
    <div v-if="points.length >= 2" class="ping-sparkline">
        <svg :viewBox="`0 0 ${width} ${height}`" preserveAspectRatio="none" aria-hidden="true">
            <defs>
                <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" :stop-color="color" stop-opacity="0.28" />
                    <stop offset="1" :stop-color="color" stop-opacity="0" />
                </linearGradient>
            </defs>
            <path :d="areaPath" :fill="`url(#${gradientId})`" />
            <path
                :d="linePath"
                fill="none"
                :stroke="color"
                stroke-width="1.5"
                stroke-linejoin="round"
                vector-effect="non-scaling-stroke"
            />
        </svg>
        <span v-if="showValue" class="ping-value">{{ lastPing }}</span>
    </div>
</template>

<script>
import { formatMs } from "../sentinelle-format.js";

export default {
    props: {
        /** ID de la sonde dont on affiche le temps de réponse */
        monitorId: {
            type: Number,
            required: true,
        },
        /** Nombre de mesures affichées */
        maxPoints: {
            type: Number,
            default: 60,
        },
        /** Couleur de la courbe (bleu-gris par défaut) */
        color: {
            type: String,
            default: "#8fa3d9",
        },
        /** Afficher la dernière valeur en ms */
        showValue: {
            type: Boolean,
            default: true,
        },
        /** Lisser la courbe (moyenne glissante) pour un rendu plus calme */
        smooth: {
            type: Boolean,
            default: false,
        },
    },

    data() {
        return {
            width: 200,
            height: 40,
            padding: 3,
        };
    },

    computed: {
        gradientId() {
            return `ping-gradient-${this.monitorId}`;
        },

        /** Temps de réponse récents (les sondes passives n'en ont pas) */
        points() {
            const beats = this.$root.heartbeatList?.[this.monitorId] || [];
            const pings = beats
                .map((beat) => beat.ping)
                .filter((ping) => typeof ping === "number")
                .slice(-this.maxPoints);
            if (!this.smooth) {
                return pings;
            }
            const windowSize = 5;
            return pings.map((_, index) => {
                const slice = pings.slice(Math.max(0, index - windowSize + 1), index + 1);
                return slice.reduce((a, b) => a + b, 0) / slice.length;
            });
        },

        lastPing() {
            return formatMs(this.points[this.points.length - 1]);
        },

        coordinates() {
            const max = Math.max(...this.points);
            const min = Math.min(...this.points);
            const span = Math.max(max - min, 1);
            const usableHeight = this.height - this.padding * 2;

            return this.points.map((ping, index) => [
                (index / (this.points.length - 1)) * this.width,
                this.height - this.padding - ((ping - min) / span) * usableHeight,
            ]);
        },

        linePath() {
            return this.coordinates
                .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
                .join(" ");
        },

        areaPath() {
            return `${this.linePath} L ${this.width} ${this.height} L 0 ${this.height} Z`;
        },
    },
};
</script>

<style lang="scss" scoped>
.ping-sparkline {
    position: relative;
    height: 40px;
    margin-top: 8px;

    svg {
        width: 100%;
        height: 100%;
        display: block;
    }
}

.ping-value {
    position: absolute;
    top: -2px;
    right: 0;
    font-size: 11.5px;
    color: #8b93ad;
}
</style>
