<template>
    <!-- Mini graphique du temps de réponse (thème homelab) -->
    <div v-if="points.length >= 2" class="ping-sparkline">
        <svg :viewBox="`0 0 ${width} ${height}`" preserveAspectRatio="none" aria-hidden="true">
            <defs>
                <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stop-color="#8fa3d9" stop-opacity="0.28" />
                    <stop offset="1" stop-color="#8fa3d9" stop-opacity="0" />
                </linearGradient>
            </defs>
            <path :d="areaPath" :fill="`url(#${gradientId})`" />
            <path
                :d="linePath"
                fill="none"
                stroke="#8fa3d9"
                stroke-width="1.5"
                stroke-linejoin="round"
                vector-effect="non-scaling-stroke"
            />
        </svg>
        <span class="ping-value">{{ lastPing }} ms</span>
    </div>
</template>

<script>
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
            return beats
                .map((beat) => beat.ping)
                .filter((ping) => typeof ping === "number")
                .slice(-this.maxPoints);
        },

        lastPing() {
            return this.points[this.points.length - 1];
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
