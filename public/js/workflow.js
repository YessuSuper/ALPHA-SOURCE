/* ── Workflow Page ── */

window.initWorkflowPage = function () {
    console.log('[Workflow] Page initialisée');

    const cards = document.querySelectorAll('.workflow-card');
    cards.forEach(card => {
        card.addEventListener('click', () => {
            const tool = card.getAttribute('data-tool');
            console.log('[Workflow] Outil sélectionné :', tool);
            // TODO: ouvrir l'outil correspondant
        });
    });
};
