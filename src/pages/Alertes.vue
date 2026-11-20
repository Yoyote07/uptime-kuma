<template>
    <!-- Page « Alertes » de Sentinelle : où et comment on est prévenu -->
    <div class="sentinelle-page">
        <div class="vigie-top">
            <div>
                <h1 class="vigie-h1">Alertes</h1>
                <div class="vigie-sub">Où tu es prévenu quand une sonde tombe ou revient</div>
            </div>
            <div class="vigie-top-actions">
                <button class="btn btn-primary" type="button" @click="openDialog()">
                    <font-awesome-icon icon="plus" />
                    Nouvelle alerte
                </button>
            </div>
        </div>

        <div v-if="alerts.length === 0" class="sentinelle-empty">
            <font-awesome-icon icon="bell" class="sentinelle-empty-icon" />
            <p>Aucune alerte configurée pour l'instant.</p>
            <p class="sentinelle-muted">
                Ajoute un canal (Discord, ntfy, e-mail…) pour être prévenu dès qu'une sonde tombe.
            </p>
            <button class="btn btn-primary" type="button" @click="openDialog()">Créer ma première alerte</button>
        </div>

        <div v-else class="alert-grid">
            <article v-for="alert in alerts" :key="alert.id" class="alert-card" :class="{ inactive: !alert.active }">
                <div class="alert-head">
                    <div class="vigie-card-avatar">{{ alert.initial }}</div>
                    <div class="alert-title">
                        <div class="alert-name">{{ alert.name }}</div>
                        <div class="alert-type">{{ alert.typeLabel }}</div>
                    </div>
                    <span v-if="alert.isDefault" class="alert-tag" title="Ajoutée automatiquement aux nouvelles sondes">
                        Par défaut
                    </span>
                </div>

                <div class="alert-monitors">
                    <div class="alert-monitors-label">
                        {{ alert.monitors.length === 0 ? "Utilisée par aucune sonde" : `Utilisée par ${alert.monitors.length} sonde${alert.monitors.length > 1 ? "s" : ""}` }}
                    </div>
                    <div v-if="alert.monitors.length" class="alert-chips">
                        <router-link
                            v-for="monitor in alert.monitors"
                            :key="monitor.id"
                            :to="`/dashboard/${monitor.id}`"
                            class="alert-chip"
                        >
                            {{ monitor.name }}
                        </router-link>
                    </div>
                </div>

                <div class="alert-actions">
                    <button class="btn btn-normal" type="button" @click="openDialog(alert.id)">
                        <font-awesome-icon icon="edit" />
                        Modifier
                    </button>
                    <button class="btn btn-normal" type="button" :disabled="testingId === alert.id" @click="test(alert)">
                        <div v-if="testingId === alert.id" class="spinner-border spinner-border-sm me-1" />
                        <font-awesome-icon v-else icon="paper-plane" />
                        Tester
                    </button>
                    <button class="btn btn-outline-danger" type="button" @click="askDelete(alert)">
                        <font-awesome-icon icon="trash" />
                        Supprimer
                    </button>
                </div>
            </article>
        </div>

        <p class="sentinelle-hint">
            Pour choisir quelles alertes reçoit une sonde, ouvre la sonde puis
            <strong>Modifier</strong> : la liste des alertes est dans le formulaire. Une alerte « Par défaut » est
            cochée automatiquement sur chaque nouvelle sonde.
        </p>

        <NotificationDialog ref="notificationDialog" />

        <Confirm
            ref="confirmDelete"
            btn-style="btn-danger"
            yes-text="Supprimer"
            no-text="Annuler"
            @yes="confirmDelete"
        >
            Supprimer l'alerte « {{ toDelete?.name }} » ? Les sondes qui l'utilisent ne seront plus prévenues par ce
            canal.
        </Confirm>
    </div>
</template>

<script>
import NotificationDialog from "../components/NotificationDialog.vue";
import Confirm from "../components/Confirm.vue";

export default {
    components: {
        NotificationDialog,
        Confirm,
    },

    data() {
        return {
            testingId: null,
            toDelete: null,
            typeNames: {},
        };
    },

    computed: {
        /**
         * Alertes enrichies : type lisible et sondes qui les utilisent
         * @returns {object[]} alertes triées par nom
         */
        alerts() {
            const monitors = Object.values(this.$root.monitorList);
            return this.$root.notificationList
                .map((notification) => {
                    const config = this.parseConfig(notification);
                    return {
                        id: notification.id,
                        name: notification.name,
                        initial: (notification.name || "?").charAt(0).toUpperCase(),
                        active: notification.active !== false && notification.active !== 0,
                        isDefault: !!notification.isDefault,
                        config,
                        typeLabel: this.typeNames[config.type] || config.type || "Type inconnu",
                        monitors: monitors
                            .filter((monitor) => monitor.notificationIDList?.[notification.id])
                            .sort((a, b) => a.name.localeCompare(b.name)),
                    };
                })
                .sort((a, b) => a.name.localeCompare(b.name));
        },
    },

    mounted() {
        // Les noms lisibles des types (Discord, ntfy…) sont déjà définis dans la fenêtre de Kuma
        this.typeNames = this.$refs.notificationDialog?.notificationFullNameList || {};
    },

    methods: {
        /**
         * Lit la configuration JSON d'une notification
         * @param {object} notification notification de $root.notificationList
         * @returns {object} configuration (vide si illisible)
         */
        parseConfig(notification) {
            try {
                return JSON.parse(notification.config) || {};
            } catch (e) {
                return {};
            }
        },

        /**
         * Ouvre la fenêtre de création (sans id) ou de modification
         * @param {number} [id] id de la notification à modifier
         * @returns {void}
         */
        openDialog(id) {
            this.$refs.notificationDialog.show(id);
        },

        /**
         * Envoie une notification de test
         * @param {object} alert alerte à tester
         * @returns {void}
         */
        test(alert) {
            this.testingId = alert.id;
            this.$root.getSocket().emit("testNotification", alert.config, (res) => {
                this.$root.toastRes(res);
                this.testingId = null;
            });
        },

        /**
         * Demande confirmation avant suppression
         * @param {object} alert alerte à supprimer
         * @returns {void}
         */
        askDelete(alert) {
            this.toDelete = alert;
            this.$refs.confirmDelete.show();
        },

        /**
         * Supprime l'alerte confirmée
         * @returns {void}
         */
        confirmDelete() {
            this.$root.getSocket().emit("deleteNotification", this.toDelete.id, (res) => {
                this.$root.toastRes(res);
                this.toDelete = null;
            });
        },
    },
};
</script>

<style lang="scss" scoped>
.alert-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(380px, 100%), 1fr));
    gap: 14px;
}

.alert-card {
    padding: 20px 22px 18px;
    border-radius: 16px;
    background: rgba(17, 24, 45, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(16px) saturate(140%);
    -webkit-backdrop-filter: blur(16px) saturate(140%);
    display: flex;
    flex-direction: column;
    gap: 16px;

    &.inactive {
        opacity: 0.6;
    }
}

.alert-head {
    display: flex;
    align-items: center;
    gap: 12px;
}

.alert-title {
    min-width: 0;
    flex: 1;
}

.alert-name {
    font-size: 16px;
    font-weight: 500;
    color: #e6e9f5;
}

.alert-type {
    font-size: 13px;
    color: #8b93ad;
}

.alert-tag {
    font-size: 12px;
    padding: 3px 10px;
    border-radius: 999px;
    color: #6fbfa3;
    border: 1px solid rgba(111, 191, 163, 0.35);
    background: rgba(111, 191, 163, 0.1);
    white-space: nowrap;
}

.alert-monitors-label {
    font-size: 13px;
    color: #8b93ad;
    margin-bottom: 8px;
}

.alert-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.alert-chip {
    font-size: 12.5px;
    padding: 3px 10px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #c9cfe0 !important;
    text-decoration: none;

    &:hover {
        border-color: rgba(143, 163, 217, 0.45);
        color: #fff !important;
    }
}

.alert-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: auto;

    .btn {
        flex: 1 1 auto;
    }
}
</style>
