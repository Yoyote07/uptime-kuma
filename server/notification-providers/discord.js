const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const dayjs = require("dayjs");
const { DOWN, UP } = require("../../src/util");

class Discord extends NotificationProvider {
    name = "discord";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        // Discord Message Flags
        // @see https://discord.com/developers/docs/resources/message#message-object-message-flags
        // This message will not trigger push and desktop notifications
        const SUPPRESS_NOTIFICATIONS_FLAG = 1 << 12;

        try {
            let config = this.getAxiosConfigWithProxy({});
            const discordDisplayName = notification.discordUsername || "Sentinelle";
            const webhookUrl = new URL(notification.discordWebhookUrl);
            if (notification.discordChannelType === "postToThread") {
                webhookUrl.searchParams.append("thread_id", notification.threadId);
            }

            // Check if the webhook has an avatar
            let webhookHasAvatar = true;
            try {
                const webhookInfo = await axios.get(webhookUrl.toString(), config);
                webhookHasAvatar = !!webhookInfo.data.avatar;
            } catch (e) {
                // If we can't verify, we assume he has an avatar to avoid forcing the default avatar
                webhookHasAvatar = true;
            }

            const messageFormat =
                notification.discordMessageFormat || (notification.discordUseMessageTemplate ? "custom" : "normal");

            // If heartbeatJSON is null, assume we're testing.
            if (heartbeatJSON == null) {
                let content = msg;
                if (messageFormat === "minimalist") {
                    content = "Test: " + msg;
                } else if (messageFormat === "custom") {
                    const customMessage = notification.discordMessageTemplate?.trim() || "";
                    if (customMessage !== "") {
                        content = await this.renderTemplate(customMessage, msg, monitorJSON, heartbeatJSON);
                    }
                }
                let discordtestdata = {
                    username: discordDisplayName,
                    content: content,
                };
                if (!webhookHasAvatar) {
                    discordtestdata.avatar_url = "https://github.com/louislam/uptime-kuma/raw/master/public/icon.png";
                }
                if (notification.discordChannelType === "createNewForumPost") {
                    discordtestdata.thread_name = notification.postName;
                }
                if (notification.discordSuppressNotifications) {
                    discordtestdata.flags = SUPPRESS_NOTIFICATIONS_FLAG;
                }
                await axios.post(webhookUrl.toString(), discordtestdata, config);
                return okMsg;
            }

            // If heartbeatJSON is not null, we go into the normal alerting loop.
            let addess = this.extractAddress(monitorJSON);

            // Minimalist: status + name only (is down / is up; no "back up" — may be first trigger)
            if (messageFormat === "minimalist") {
                const content =
                    heartbeatJSON["status"] === DOWN
                        ? "🔴 " + monitorJSON["name"] + " est hors service."
                        : "🟢 " + monitorJSON["name"] + " fonctionne.";
                let payload = {
                    username: discordDisplayName,
                    content: content,
                };
                if (!webhookHasAvatar) {
                    payload.avatar_url = "https://github.com/louislam/uptime-kuma/raw/master/public/icon.png";
                }
                if (notification.discordChannelType === "createNewForumPost") {
                    payload.thread_name = notification.postName;
                }
                if (notification.discordSuppressNotifications) {
                    payload.flags = SUPPRESS_NOTIFICATIONS_FLAG;
                }
                await axios.post(webhookUrl.toString(), payload, config);
                return okMsg;
            }

            // Custom template: send only content (no embeds)
            const useCustomTemplate =
                messageFormat === "custom" && (notification.discordMessageTemplate?.trim() || "") !== "";
            if (useCustomTemplate) {
                const content = await this.renderTemplate(
                    notification.discordMessageTemplate.trim(),
                    msg,
                    monitorJSON,
                    heartbeatJSON
                );
                let payload = {
                    username: discordDisplayName,
                    content: content,
                };
                if (!webhookHasAvatar) {
                    payload.avatar_url = "https://github.com/louislam/uptime-kuma/raw/master/public/icon.png";
                }
                if (notification.discordChannelType === "createNewForumPost") {
                    payload.thread_name = notification.postName;
                }
                if (notification.discordSuppressNotifications) {
                    payload.flags = SUPPRESS_NOTIFICATIONS_FLAG;
                }
                await axios.post(webhookUrl.toString(), payload, config);
                return okMsg;
            }

            if (heartbeatJSON["status"] === DOWN) {
                const wentOfflineTimestamp = dayjs.utc(heartbeatJSON["time"]).unix();

                let discorddowndata = {
                    username: discordDisplayName,
                    embeds: [
                        {
                            title: "🔴 " + monitorJSON["name"] + " est hors service",
                            color: 0xe06c75,
                            footer: { text: "Sentinelle · homelab" },
                            timestamp: heartbeatJSON["time"],
                            fields: [
                                {
                                    name: "Service",
                                    value: monitorJSON["name"],
                                    inline: true,
                                },
                                ...(!notification.disableUrl && addess
                                    ? [
                                          {
                                              name: monitorJSON["type"] === "push" ? "Type" : "Adresse",
                                              value: addess,
                                              inline: true,
                                          },
                                      ]
                                    : []),
                                {
                                    name: "Hors service depuis",
                                    // F for full date/time
                                    value: `<t:${wentOfflineTimestamp}:F>`,
                                },
                                {
                                    name: `Heure (${heartbeatJSON["timezone"]})`,
                                    value: heartbeatJSON["localDateTime"],
                                },
                                {
                                    name: "Erreur",
                                    value: heartbeatJSON["msg"] == null ? "N/A" : heartbeatJSON["msg"],
                                },
                            ],
                        },
                    ],
                };
                if (!webhookHasAvatar) {
                    discorddowndata.avatar_url = "https://github.com/louislam/uptime-kuma/raw/master/public/icon.png";
                }
                if (notification.discordChannelType === "createNewForumPost") {
                    discorddowndata.thread_name = notification.postName;
                }
                if (notification.discordPrefixMessage) {
                    discorddowndata.content = notification.discordPrefixMessage;
                }
                if (notification.discordSuppressNotifications) {
                    discorddowndata.flags = SUPPRESS_NOTIFICATIONS_FLAG;
                }

                await axios.post(webhookUrl.toString(), discorddowndata, config);
                return okMsg;
            } else if (heartbeatJSON["status"] === UP) {
                const backOnlineTimestamp = dayjs.utc(heartbeatJSON["time"]).unix();
                let downtimeDuration = null;
                let wentOfflineTimestamp = null;
                if (heartbeatJSON["lastDownTime"]) {
                    wentOfflineTimestamp = dayjs.utc(heartbeatJSON["lastDownTime"]).unix();
                    downtimeDuration = this.formatDuration(backOnlineTimestamp - wentOfflineTimestamp);
                }

                let discordupdata = {
                    username: discordDisplayName,
                    embeds: [
                        {
                            title: "🟢 " + monitorJSON["name"] + " est de retour",
                            color: 0x6fbfa3,
                            footer: { text: "Sentinelle · homelab" },
                            timestamp: heartbeatJSON["time"],
                            fields: [
                                {
                                    name: "Service",
                                    value: monitorJSON["name"],
                                    inline: true,
                                },
                                ...(!notification.disableUrl && addess
                                    ? [
                                          {
                                              name: monitorJSON["type"] === "push" ? "Type" : "Adresse",
                                              value: addess,
                                              inline: true,
                                          },
                                      ]
                                    : []),
                                ...(wentOfflineTimestamp
                                    ? [
                                          {
                                              name: "Hors service depuis",
                                              // F for full date/time
                                              value: `<t:${wentOfflineTimestamp}:F>`,
                                          },
                                      ]
                                    : []),
                                ...(downtimeDuration
                                    ? [
                                          {
                                              name: "Durée de la panne",
                                              value: downtimeDuration,
                                              inline: true,
                                          },
                                      ]
                                    : []),
                                // Show server timezone for parity with the DOWN notification embed
                                {
                                    name: `Heure (${heartbeatJSON["timezone"]})`,
                                    value: heartbeatJSON["localDateTime"],
                                },
                                ...(heartbeatJSON["ping"] != null
                                    ? [
                                          {
                                              name: "Temps de réponse",
                                              value: heartbeatJSON["ping"] + " ms",
                                              inline: true,
                                          },
                                      ]
                                    : []),
                            ],
                        },
                    ],
                };
                if (!webhookHasAvatar) {
                    discordupdata.avatar_url = "https://github.com/louislam/uptime-kuma/raw/master/public/icon.png";
                }

                if (notification.discordChannelType === "createNewForumPost") {
                    discordupdata.thread_name = notification.postName;
                }

                if (notification.discordPrefixMessage) {
                    discordupdata.content = notification.discordPrefixMessage;
                }
                if (notification.discordSuppressNotifications) {
                    discordupdata.flags = SUPPRESS_NOTIFICATIONS_FLAG;
                }

                await axios.post(webhookUrl.toString(), discordupdata, config);
                return okMsg;
            }
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }

    /**
     * Format duration as human-readable string (e.g., "1h 23m", "45m 30s")
     * TODO: Update below to `Intl.DurationFormat("en", { style: "short" }).format(duration)` once we are on a newer node version
     * @param {number} timeInSeconds The time in seconds to format a duration for
     * @returns {string} The formatted duration
     */
    formatDuration(timeInSeconds) {
        const hours = Math.floor(timeInSeconds / 3600);
        const minutes = Math.floor((timeInSeconds % 3600) / 60);
        const seconds = timeInSeconds % 60;

        const durationParts = [];
        if (hours > 0) {
            durationParts.push(`${hours}h`);
        }
        if (minutes > 0) {
            durationParts.push(`${minutes}m`);
        }
        if (seconds > 0 && hours === 0) {
            // Only show seconds if less than an hour
            durationParts.push(`${seconds}s`);
        }

        return durationParts.length > 0 ? durationParts.join(" ") : "0s";
    }
}

module.exports = Discord;
