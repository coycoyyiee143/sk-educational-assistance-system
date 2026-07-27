export function getApplicationPeriodStatus(config) {
    if (!config) return "none";
    const now = new Date();
    const opens = new Date(config.open_date);
    const closes = new Date(config.close_date);

    if (!config.is_active) return "inactive";
    if (now < opens) return "scheduled";
    if (now > closes) return "closed";
    return "open";
}