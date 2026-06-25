(function () {
    const NAV_FLAG_KEY = 'wc_stage4_nav';
    const ENTER_HOLD_MS = 380;
    const SWITCH_HOLD_MS = 170;

    function createOverlay(isSectionSwitch) {
        const overlay = document.createElement('div');
        overlay.className = 'stage4-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.innerHTML = [
            '<div class="stage4-overlay__orb stage4-overlay__orb--left"></div>',
            '<div class="stage4-overlay__orb stage4-overlay__orb--right"></div>',
            '<div class="stage4-overlay__content">',
            '<p class="stage4-overlay__eyebrow">WORLD CUP FRIENDS</p>',
            '<h2 class="stage4-overlay__title">Matchday Entrance</h2>',
            `<p class="stage4-overlay__subtitle">${isSectionSwitch ? 'Switching section...' : 'Preparing your dashboard...'}</p>`,
            '</div>'
        ].join('');
        document.body.appendChild(overlay);
        return overlay;
    }

    function beginEntrance() {
        const isSectionSwitch = sessionStorage.getItem(NAV_FLAG_KEY) === '1';
        sessionStorage.removeItem(NAV_FLAG_KEY);

        document.body.classList.add('stage4-pending');
        const overlay = createOverlay(isSectionSwitch);

        requestAnimationFrame(() => {
            overlay.classList.add('is-visible');
        });

        const holdMs = isSectionSwitch ? SWITCH_HOLD_MS : ENTER_HOLD_MS;
        window.setTimeout(() => {
            document.body.classList.add('stage4-ready');
            overlay.classList.add('is-exiting');

            window.setTimeout(() => {
                overlay.remove();
                document.body.classList.remove('stage4-pending');
            }, 300);
        }, holdMs);
    }

    function shouldHandleLink(anchor, event) {
        if (!anchor || event.defaultPrevented) return false;
        if (anchor.hasAttribute('download')) return false;
        if (anchor.target && anchor.target !== '_self') return false;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;

        const href = anchor.getAttribute('href') || '';
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return false;
        if (href.startsWith('mailto:') || href.startsWith('tel:')) return false;
        if (anchor.dataset.noTransition === 'true') return false;

        const url = new URL(anchor.href, window.location.origin);
        if (url.origin !== window.location.origin) return false;
        if (url.pathname === window.location.pathname && url.search === window.location.search) return false;

        return true;
    }

    function installLinkTransitions() {
        document.addEventListener('click', (event) => {
            const anchor = event.target.closest('a');
            if (!shouldHandleLink(anchor, event)) return;

            event.preventDefault();
            sessionStorage.setItem(NAV_FLAG_KEY, '1');

            const exitOverlay = document.createElement('div');
            exitOverlay.className = 'stage4-overlay stage4-overlay--exit is-visible';
            exitOverlay.setAttribute('aria-hidden', 'true');
            document.body.appendChild(exitOverlay);

            window.setTimeout(() => {
                window.location.href = anchor.href;
            }, 165);
        });
    }

    window.addEventListener('DOMContentLoaded', () => {
        beginEntrance();
        installLinkTransitions();
    });
})();