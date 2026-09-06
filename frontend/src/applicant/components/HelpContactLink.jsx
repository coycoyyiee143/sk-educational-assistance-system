// Context-aware help link — pre-fills the application ID and the reason
// the applicant landed here, so SK staff reading the message don't start
// from zero. Replace the placeholder email below with SK's real contact
// once confirmed.
function HelpContactLink({ applicationId, context }) {
    const subject = encodeURIComponent(`SK-EAS Help Request — Application #${applicationId ?? "N/A"}`);
    const body = encodeURIComponent(
        `Hi SK Mamatid,\n\nI need help with my educational assistance application.\n\nApplication ID: ${applicationId ?? "N/A"}\nSituation: ${context}\n\n(Please describe your issue here)`
    );
    return (

        <a href={`mailto:skmamatid.educassist@gmail.com?subject=${subject}&body=${body}`}
            className="btn btn-outline-secondary btn-sm mt-2"
        >
            Need help ? Message SK
        </a >
    );
}

export default HelpContactLink;