// ============== APP STATE (balance + transactions) ==============
// El balance y las transacciones se persisten en localStorage para que
// sobrevivan al cerrar sesión y al recargar la página.
const BALANCE_KEY = "roblox_clone_balance";

function loadBalanceState() {
    try {
        const raw = localStorage.getItem(BALANCE_KEY);
        if (raw) {
            const data = JSON.parse(raw);
            return {
                balance: Number(data.balance) || 0,
                transactions: Array.isArray(data.transactions) ? data.transactions : [],
            };
        }
    } catch (_) { /* ignore */ }
    return { balance: 0, transactions: [] };
}

function saveBalanceState() {
    try {
        localStorage.setItem(BALANCE_KEY, JSON.stringify({
            balance: appState.balance,
            transactions: appState.transactions,
        }));
    } catch (_) { /* ignore quota errors */ }
}

// Detect Android / Mobile
if (/android|mobile|touch/i.test(navigator.userAgent || "") || (window.innerWidth <= 768)) {
    document.documentElement.classList.add("is-android");
}
window.addEventListener("resize", () => {
    if (window.innerWidth <= 768 || /android|mobile|touch/i.test(navigator.userAgent || "")) {
        document.documentElement.classList.add("is-android");
    } else {
        document.documentElement.classList.remove("is-android");
    }
});

const appState = loadBalanceState();

// Pintar el balance y las transacciones persistidas al cargar la página
updateBalanceDisplay();
updateTransactionsDisplay();

function formatNum(n) {
    return Number(n || 0).toLocaleString("en-US");
}

function updateBalanceDisplay() {
    document.querySelectorAll("[data-app-balance]").forEach((el) => {
        el.textContent = formatNum(appState.balance);
    });
}

function updateTransactionsDisplay() {
    const incoming = appState.transactions
        .filter((t) => t.type === "in")
        .reduce((sum, t) => sum + t.amount, 0);
    const outgoing = appState.transactions
        .filter((t) => t.type === "out")
        .reduce((sum, t) => sum + t.amount, 0);
    document.querySelectorAll("[data-tx-incoming]").forEach((el) => {
        el.textContent = formatNum(incoming);
    });
    document.querySelectorAll("[data-tx-outgoing]").forEach((el) => {
        el.textContent = formatNum(outgoing);
    });
}

function addTransaction(type, amount, party) {
    appState.transactions.unshift({
        type,
        amount,
        party: party || "",
        date: new Date(),
    });
    if (type === "in") appState.balance += amount;
    else if (type === "out") appState.balance = Math.max(0, appState.balance - amount);
    updateBalanceDisplay();
    updateTransactionsDisplay();
    saveBalanceState();
}

function setButtonLoading(btn, loading, label) {
    if (!btn) return;
    if (loading) {
        btn.dataset.originalHtml = btn.innerHTML;
        btn.innerHTML = `<span class="btn-spinner" aria-hidden="true"></span>${label || "Procesando..."}`;
        btn.classList.add("loading");
        btn.disabled = true;
    } else {
        if (btn.dataset.originalHtml) {
            btn.innerHTML = btn.dataset.originalHtml;
            delete btn.dataset.originalHtml;
        }
        btn.classList.remove("loading");
        btn.disabled = false;
    }
}

// ============== Global helpers ==============
function showToast(message) {
    const t = document.createElement("div");
    t.className = "send-toast";
    t.textContent = message;
    document.body.appendChild(t);
    setTimeout(() => {
        t.style.transition = "opacity 0.2s, transform 0.2s";
        t.style.opacity = "0";
        t.style.transform = "translate(-50%, 10px)";
        setTimeout(() => t.remove(), 220);
    }, 2200);
}

// Muestra un mensaje de error dentro del modal de login (arriba del form)
// Definida globalmente para que sea accesible desde cualquier IIFE
function showLoginError(html) {
    const el = document.getElementById("loginErrorMsg");
    if (!el) return;
    if (!html) {
        el.hidden = true;
        el.innerHTML = "";
    } else {
        el.innerHTML = html;
        el.hidden = false;
    }
}

// Escape de HTML — global para uso compartido entre IIFEs
function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
}

// ============== Session helper (global) ==============
const SESSION_KEY = "roblox_clone_session";
const DEFAULT_AVATAR = "1.webp";
function getSession() {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
}

// Toast con checkmark negro, aparece ARRIBA (estilo Roblox)
// Usado para confirmar el envío de Robux
function showSendSuccessToast(amount) {
    const existing = document.getElementById("sendSuccessToast");
    if (existing) existing.remove();

    const t = document.createElement("div");
    t.id = "sendSuccessToast";
    t.className = "send-success-toast";
    t.innerHTML = `
        <span class="send-success-toast-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
            </svg>
        </span>
        <span>Enviaste ${formatNum(amount)} Robux</span>
    `;
    document.body.appendChild(t);
    setTimeout(() => {
        t.style.transition = "opacity 0.2s, transform 0.2s";
        t.style.opacity = "0";
        t.style.transform = "translate(-50%, -10px)";
        setTimeout(() => t.remove(), 220);
    }, 2500);
}

// ============== TAB SWITCHING & LAYOUT INTERACTION ==============
(function () {
    const tabs = document.querySelectorAll(".tab");
    const sections = document.querySelectorAll(".section");

    function shuffleMercadoCards() {
        const grid = document.querySelector("#mercado .mercado-grid");
        if (!grid) return;
        const cards = Array.from(grid.querySelectorAll(".item-card"));
        for (let i = cards.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [cards[i], cards[j]] = [cards[j], cards[i]];
        }
        cards.forEach((card) => grid.appendChild(card));
    }

    function normalizeAssetUrl(src) {
        if (!src || src.startsWith("data:")) return src;
        return encodeURI(src);
    }

    function bindMarketplaceImageFallback(img) {
        const originalSrc = img.getAttribute("src");
        if (!originalSrc) return;

        const normalizedSrc = normalizeAssetUrl(originalSrc);
        if (normalizedSrc !== originalSrc) {
            img.setAttribute("src", normalizedSrc);
        }

        const fallbackSrc = originalSrc.replace(/\.webp$/i, ".png").replace(/\.png$/i, ".webp");
        if (fallbackSrc !== originalSrc) {
            img.addEventListener("error", () => {
                const current = img.getAttribute("src");
                if (current !== fallbackSrc) {
                    img.setAttribute("src", fallbackSrc);
                } else {
                    img.style.opacity = "0.25";
                    img.setAttribute("alt", `${img.getAttribute("alt") || "Imagen"} no disponible`);
                }
            }, { once: true });
        }
    }

    function loadMercadoImages() {
        shuffleMercadoCards();
        document.querySelectorAll("#mercado .item-thumb img").forEach((img) => {
            const src = img.getAttribute("src");
            if (!src) return;
            img.loading = "eager";
            img.decoding = "async";
            bindMarketplaceImageFallback(img);
            if (!img.complete || img.naturalWidth === 0) {
                img.src = normalizeAssetUrl(src);
            }
        });
    }

    function setupDestacadasCarousels() {
        document.querySelectorAll("#destacadas .subsection").forEach((section) => {
            const carousel = section.querySelector(".carousel");
            if (!carousel || section.querySelector(".carousel-next")) return;

            const nextButton = document.createElement("button");
            nextButton.type = "button";
            nextButton.className = "carousel-next";
            nextButton.setAttribute("aria-label", "Siguiente");
            nextButton.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
            `;

            nextButton.addEventListener("click", () => {
                const step = Math.max(carousel.clientWidth * 0.82, 320);
                const atEnd = carousel.scrollLeft + carousel.clientWidth >= carousel.scrollWidth - 8;
                carousel.scrollTo({
                    left: atEnd ? 0 : carousel.scrollLeft + step,
                    behavior: "smooth"
                });
            });

            section.appendChild(nextButton);
        });
    }

    function activateTab(tabName) {
        if (!tabName) return;
        tabs.forEach((t) => {
            t.classList.toggle("active", t.dataset.tab === tabName);
        });
        sections.forEach((s) => {
            s.classList.toggle("section-active", s.id === tabName);
        });
        if (tabName === "destacadas") setupDestacadasCarousels();
        if (tabName === "mercado") loadMercadoImages();
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    setupDestacadasCarousels();

    tabs.forEach((tab) => {
        tab.addEventListener("click", (e) => {
            if (tab.tagName === "A" || tab.getAttribute("href")) {
                e.preventDefault();
            }
            activateTab(tab.dataset.tab);
        });
    });

    // External buttons that jump to a specific tab (data-go-to="<tabname>")
    document.querySelectorAll("[data-go-to]").forEach((el) => {
        el.addEventListener("click", (e) => {
            if (el.dataset.goTo === "pago") return;
            e.preventDefault();
            activateTab(el.dataset.goTo);
        });
    });

    document.addEventListener("click", (e) => {
        const target = e.target instanceof Element ? e.target : e.target?.parentElement;
        const tab = target?.closest(".tab[data-tab], [data-go-to]");
        if (!tab) return;
        const tabName = tab.dataset.tab || tab.dataset.goTo;
        if (!tabName || tabName === "pago") return;
        if (tab.tagName === "A" || tab.getAttribute("href") || tab.dataset.goTo) {
            e.preventDefault();
        }
        activateTab(tabName);
    });

    // Mobile sidebar toggle (hamburger menu)
    const menuBtn = document.querySelector(".menu-button") || document.getElementById("header-menu-icon");
    const leftNav = document.querySelector(".left-nav");
    if (menuBtn && leftNav) {
        menuBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            document.body.classList.toggle("sidebar-open");
        });

        // Close sidebar when clicking outside on mobile
        document.addEventListener("click", (e) => {
            if (document.body.classList.contains("sidebar-open")) {
                if (!leftNav.contains(e.target) && !menuBtn.contains(e.target)) {
                    document.body.classList.remove("sidebar-open");
                }
            }
        });
    }

    // Chat expand/collapse toggle
    const chatHeader = document.getElementById("chat-header");
    const chatContainer = document.getElementById("chat-container");
    if (chatHeader && chatContainer) {
        chatHeader.addEventListener("click", () => {
            chatContainer.classList.toggle("collapsed");
        });
    }
})();

// ============== MODAL: ENVIAR ROBUX ==============
(function () {
    const overlay = document.getElementById("sendModal");
    const openBtn = document.getElementById("openSendModal");
    const closeBtn = document.getElementById("closeSendModal");
    if (!overlay || !openBtn || !closeBtn) return;

    const searchInput = document.getElementById("userSearch");
    const stateInitial = document.getElementById("modalState");
    const stateLoading = document.getElementById("modalLoading");
    const stateResults = document.getElementById("modalResults");
    const stateNoResults = document.getElementById("modalNoResults");
    const stateError = document.getElementById("modalError");
    const fallbackBanner = document.getElementById("fallbackBanner");

    function showState(name) {
        [stateInitial, stateLoading, stateResults, stateNoResults, stateError].forEach((el) => {
            if (!el) return;
            el.hidden = el.dataset.state !== name && !el.classList.contains(`modal-state-${name}`);
        });
    }
    function showOnly(name) {
        [stateInitial, stateLoading, stateResults, stateNoResults, stateError].forEach((el) => {
            if (!el) return;
            el.hidden = true;
        });
        const map = {
            initial: stateInitial,
            loading: stateLoading,
            results: stateResults,
            noresults: stateNoResults,
            error: stateError,
        };
        if (map[name]) map[name].hidden = false;
    }

    function openModal() {
        overlay.classList.add("open");
        overlay.setAttribute("aria-hidden", "false");
        // Limpiar cualquier flow residual (loading, amount, confirm) de la sesión anterior
        const stale = overlay.querySelectorAll(".send-flow");
        stale.forEach((el) => el.remove());
        // Resetear estado del envío
        sendState.user = null;
        sendState.amount = 0;
        sendState.step = null;
        // Mostrar la lista de recientes al abrir el modal
        renderRecents();
        showOnly("initial");
        setTimeout(() => searchInput.focus(), 150);
        document.body.style.overflow = "hidden";
    }
    function closeModal() {
        overlay.classList.remove("open");
        overlay.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
        // reset state on close
        searchInput.value = "";
        // Limpiar cualquier send-flow (loading, amount, confirm) que haya quedado
        const stale = overlay.querySelectorAll(".send-flow");
        stale.forEach((el) => el.remove());
        showOnly("initial");
        fallbackBanner.hidden = true;
    }

    openBtn.addEventListener("click", openModal);
    closeBtn.addEventListener("click", closeModal);
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeModal();
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && overlay.classList.contains("open")) closeModal();
    });

    // ============== USER SEARCH ==============
    // Detect environment: localhost → local proxy, anything else → netlify function
    const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.protocol === "file:";
    const API_BASE = isLocal ? "http://localhost:3000" : "/.netlify/functions/roblox-user";

    // Fallback users — used when the proxy is offline so the UI never breaks
    const FALLBACK_USERS = [
        { id: 1, name: "Roblox", displayName: "Roblox", hasVerifiedBadge: true, avatarUrl: null },
        { id: 2, name: "Stickmasterluke", displayName: "Stickmasterluke", hasVerifiedBadge: true, avatarUrl: null },
        { id: 3, name: "Shedletsky", displayName: "Shedletsky", hasVerifiedBadge: true, avatarUrl: null },
        { id: 4, name: "Saturu_Gojo", displayName: "Saturu_Gojo", hasVerifiedBadge: false, avatarUrl: null },
        { id: 5, name: "SharkBlox", displayName: "SharkBlox", hasVerifiedBadge: false, avatarUrl: null },
        { id: 6, name: "Stail", displayName: "Stail", hasVerifiedBadge: false, avatarUrl: null },
    ];

    function buildUserUrl(name) {
        return isLocal
            ? `${API_BASE}/api/user/${encodeURIComponent(name)}`
            : `${API_BASE}?name=${encodeURIComponent(name)}`;
    }

    function initialOf(name) {
        return (name || "?").trim().charAt(0).toUpperCase();
    }

    function userCard(user) {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "user-card";
        card.dataset.userId = user.id;

        const avatar = document.createElement("div");
        avatar.className = "user-avatar";
        if (user.avatarUrl) {
            const img = document.createElement("img");
            img.src = user.avatarUrl;
            img.alt = user.displayName || user.name;
            img.loading = "lazy";
            img.referrerPolicy = "no-referrer";
            img.onerror = () => {
                img.remove();
                avatar.textContent = initialOf(user.displayName || user.name);
            };
            avatar.appendChild(img);
        } else {
            avatar.textContent = initialOf(user.displayName || user.name);
        }

        const info = document.createElement("div");
        info.className = "user-info";

        const display = document.createElement("div");
        display.className = "user-display";
        display.textContent = user.displayName || user.name;
        if (user.hasVerifiedBadge) {
            const v = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            v.setAttribute("class", "verified-badge");
            v.setAttribute("viewBox", "0 0 24 24");
            v.setAttribute("width", "14");
            v.setAttribute("height", "14");
            v.setAttribute("fill", "currentColor");
            const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
            p.setAttribute("d", "M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z");
            v.appendChild(p);
            display.appendChild(v);
        }

        const name = document.createElement("div");
        name.className = "user-name";
        name.textContent = "@" + user.name;

        info.appendChild(display);
        info.appendChild(name);

        const action = document.createElement("div");
        action.className = "user-action";
        action.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';

        card.appendChild(avatar);
        card.appendChild(info);
        card.appendChild(action);

        card.addEventListener("click", () => selectUser(user, card));
        return card;
    }

    function renderResults(users) {
        stateResults.innerHTML = "";
        if (!users || users.length === 0) {
            showOnly("noresults");
            return;
        }
        const heading = document.createElement("h3");
        heading.className = "modal-section-title";
        heading.textContent = "Resultados";
        stateResults.appendChild(heading);

        const list = document.createElement("div");
        list.className = "user-list";
        users.forEach((u) => list.appendChild(userCard(u)));
        stateResults.appendChild(list);
        showOnly("results");
    }

    // ============== SEND FLOW (multi-step) ==============
    let sendState = {
        user: null,
        amount: 0,
    };

    // ============== Recientes (últimos usuarios a los que se envió) ==============
    const RECENTS_KEY = "roblox_clone_send_recents";
    const RECENTS_MAX = 5;

    function loadRecents() {
        try {
            const raw = localStorage.getItem(RECENTS_KEY);
            const arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr : [];
        } catch (_) { return []; }
    }
    function saveRecents(arr) {
        try {
            localStorage.setItem(RECENTS_KEY, JSON.stringify(arr.slice(0, RECENTS_MAX)));
        } catch (_) {}
    }
    function addRecent(user) {
        if (!user) return;
        const arr = loadRecents();
        // Quitar duplicado por id
        const filtered = arr.filter((u) => u.id !== user.id);
        // Agregar al frente
        filtered.unshift({
            id: user.id,
            name: user.name,
            displayName: user.displayName,
            hasVerifiedBadge: user.hasVerifiedBadge,
            avatarUrl: user.avatarUrl || null,
        });
        saveRecents(filtered);
        renderRecents();
    }
    function renderRecents() {
        const list = document.getElementById("recentsList");
        const empty = document.getElementById("recentsEmpty");
        const count = document.getElementById("recentsCount");
        if (!list) return;
        const arr = loadRecents();
        list.innerHTML = "";
        if (count) count.textContent = `(${arr.length})`;
        if (arr.length === 0) {
            if (empty) empty.hidden = false;
            return;
        }
        if (empty) empty.hidden = true;
        arr.forEach((u) => {
            list.appendChild(userCard(u));
        });
    }

    function avatarImg(user) {
        if (user.avatarUrl) {
            return `<img src="${escapeHtml(user.avatarUrl)}" alt="" onerror="this.remove();this.parentNode.textContent='${escapeHtml(initialOf(user.displayName || user.name))}'" />`;
        }
        return escapeHtml(initialOf(user.displayName || user.name));
    }

    // Generate consistent mock details per user
    function recipientDetails(user) {
        const key = (user.name || "").toString();
        let hash = 0;
        for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
        const months = (hash % 36) + 1;
        const friends = hash % 16;
        const year = 2015 + (hash % 8);
        return { months, friends, year };
    }

    function showSendStep(step) {
        sendState.step = step;
        // Hide all other states inside the modal body
        [stateInitial, stateLoading, stateResults, stateNoResults, stateError].forEach((el) => {
            if (!el) return;
            el.hidden = true;
        });
        // Remove any previous send-flow container
        const existing = stateResults.parentNode.querySelector(".send-flow");
        if (existing) existing.remove();

        if (step === "results") {
            stateResults.hidden = false;
            return;
        }

        // Create send-flow container
        const flow = document.createElement("div");
        flow.className = "send-flow";
        flow.dataset.step = step;

        if (step === "amount") flow.innerHTML = amountStepHTML(sendState.user);
        else if (step === "confirm") flow.innerHTML = confirmStepHTML(sendState.user, sendState.amount);
        else if (step === "loading") flow.innerHTML = loadingStepHTML();
        else if (step === "success") flow.innerHTML = successStepHTML(sendState.user, sendState.amount);

        // Insert into modal body, after the search input
        const searchInput = document.getElementById("userSearch");
        searchInput.parentNode.insertBefore(flow, searchInput.nextSibling);

        wireSendStep(flow, step);
    }

    function amountStepHTML(user) {
        return `
            <div class="send-step" data-step="amount">
                <div class="send-recipient">
                    <button class="send-back-btn" type="button" data-action="back" aria-label="Volver">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    </button>
                    <div class="send-recipient-avatar">${avatarImg(user)}</div>
                    <div class="send-recipient-name">${escapeHtml(user.displayName || user.name)}</div>
                </div>
                <div class="send-amount-display">
                    <span class="robux-hex"></span>
                    <input type="number" min="1" class="send-amount-input" value="${sendState.amount || ""}" placeholder="0" inputmode="numeric" />
                </div>
                <div class="send-amount-chips">
                    <button class="send-amount-chip" type="button" data-amount="25"><span class="robux-hex-small"></span> 25</button>
                    <button class="send-amount-chip" type="button" data-amount="50"><span class="robux-hex-small"></span> 50</button>
                    <button class="send-amount-chip" type="button" data-amount="100"><span class="robux-hex-small"></span> 100</button>
                    <button class="send-amount-chip" type="button" data-amount="200"><span class="robux-hex-small"></span> 200</button>
                </div>
                <button class="send-primary-btn" type="button" data-action="next" disabled>Siguiente</button>
                <p class="send-fee-note">Los Robux se envían al instante sin comisiones</p>
            </div>
        `;
    }

    function confirmStepHTML(user, amount) {
        const d = recipientDetails(user);
        return `
            <div class="send-step" data-step="confirm">
                <div class="send-recipient">
                    <button class="send-back-btn" type="button" data-action="back" aria-label="Volver">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    </button>
                    <div class="send-recipient-avatar">${avatarImg(user)}</div>
                    <div class="send-recipient-name">${escapeHtml(user.displayName || user.name)}</div>
                    <div class="send-recipient-username">@${escapeHtml(user.name)}</div>
                    <div class="send-recipient-details">
                        <span class="send-detail">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                            Conectado hace ${d.months} ${d.months === 1 ? "mes" : "meses"}
                        </span>
                        <span class="send-detail">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                            ${d.friends} amigos en común
                        </span>
                        <span class="send-detail">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                            En Roblox desde ${d.year}
                        </span>
                    </div>
                </div>
                <div class="send-amount-display">
                    <span class="robux-hex"></span>
                    <span class="send-amount-input" style="border:none;outline:none;background:none;width:auto;padding:0;">${formatNum(amount)}</span>
                </div>
                <p class="send-confirm-text">El destinatario recibirá <strong>${formatNum(amount)}</strong> Robux.</p>
                <div class="send-actions">
                    <button class="send-primary-btn active" type="button" data-action="send">Enviar</button>
                    <button class="send-secondary-btn" type="button" data-action="edit">Editar</button>
                </div>
                <p class="send-fee-note">Necesitas verificación de edad o consentimiento parental para enviar Robux</p>
            </div>
        `;
    }

    function loadingStepHTML() {
        return `
            <div class="send-step" data-step="loading">
                <div class="send-loading">
                    <div class="spinner" aria-hidden="true"></div>
                    <p>Enviando Robux…</p>
                </div>
            </div>
        `;
    }

    function successStepHTML(user, amount) {
        return `
            <div class="send-step" data-step="success">
                <div class="send-success">
                    <div class="send-success-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <h3>Enviaste ${formatNum(amount)} Robux</h3>
                </div>
            </div>
        `;
    }

    function formatNum(n) {
        return Number(n || 0).toLocaleString("en-US");
    }

    function wireSendStep(flow, step) {
        if (step === "amount") {
            const input = flow.querySelector(".send-amount-input");
            const chips = flow.querySelectorAll(".send-amount-chip");
            const nextBtn = flow.querySelector('[data-action="next"]');
            const backBtn = flow.querySelector('[data-action="back"]');

            function updateAmount(value) {
                sendState.amount = parseInt(value, 10) || 0;
                chips.forEach((c) => c.classList.toggle("selected", parseInt(c.dataset.amount, 10) === sendState.amount));
                if (sendState.amount > 0) {
                    nextBtn.classList.add("active");
                    nextBtn.disabled = false;
                } else {
                    nextBtn.classList.remove("active");
                    nextBtn.disabled = true;
                }
            }

            input.addEventListener("input", (e) => updateAmount(e.target.value));
            chips.forEach((chip) => {
                chip.addEventListener("click", () => {
                    const v = parseInt(chip.dataset.amount, 10);
                    input.value = v;
                    updateAmount(v);
                });
            });
            nextBtn.addEventListener("click", () => {
                if (sendState.amount > 0) showSendStep("confirm");
            });
            backBtn.addEventListener("click", () => showSendStep("results"));
            updateAmount(sendState.amount);

            setTimeout(() => input.focus(), 100);
        } else if (step === "confirm") {
            const backBtn = flow.querySelector('[data-action="back"]');
            const editBtn = flow.querySelector('[data-action="edit"]');
            const sendBtn = flow.querySelector('[data-action="send"]');
            backBtn && backBtn.addEventListener("click", () => showSendStep("amount"));
            editBtn && editBtn.addEventListener("click", () => showSendStep("amount"));
            sendBtn && sendBtn.addEventListener("click", () => {
                const amount = sendState.amount;
                const recipient = sendState.user ? (sendState.user.name || "") : "";
                setButtonLoading(sendBtn, true, "Enviando...");
                setTimeout(() => {
                    setButtonLoading(sendBtn, false);
                    showSendStep("loading");
                    setTimeout(() => {
                        addTransaction("out", amount, recipient);
                        // Guardar el destinatario en recientes para la próxima vez
                        addRecent(sendState.user);
                        // Mostrar el toast flotante superior y cerrar el modal.
                        showSendSuccessToast(amount);
                        setTimeout(closeModal, 600);
                    }, 800);
                }, 700);
            });
        }
    }

    function selectUser(user, cardEl) {
        sendState.user = user;
        sendState.amount = 0;
        showSendStep("amount");
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
        })[c]);
    }

    let lastReq = 0;
    let debounceId = null;
    async function search(query) {
        query = (query || "").trim();
        if (query.length === 0) {
            fallbackBanner.hidden = true;
            showOnly("initial");
            return;
        }
        if (query.length < 3) {
            fallbackBanner.hidden = true;
            showOnly("initial");
            return;
        }
        const reqId = ++lastReq;
        showOnly("loading");
        try {
            const ctrl = new AbortController();
            const timeout = setTimeout(() => ctrl.abort(), 5000);
            const res = await fetch(buildUserUrl(query), { signal: ctrl.signal });
            clearTimeout(timeout);
            if (reqId !== lastReq) return; // stale
            if (res.status === 404) {
                fallbackBanner.hidden = true;
                renderResults([]);
                return;
            }
            if (!res.ok) throw new Error("HTTP " + res.status);
            const user = await res.json();
            if (reqId !== lastReq) return;
            fallbackBanner.hidden = true;
            renderResults([user]);
        } catch (e) {
            if (reqId !== lastReq) return;
            // Proxy down / network error — use fallback
            const filtered = FALLBACK_USERS.filter((u) => {
                const q = query.toLowerCase();
                return u.name.toLowerCase().includes(q) || (u.displayName && u.displayName.toLowerCase().includes(q));
            });
            fallbackBanner.hidden = false;
            if (filtered.length === 0) {
                showOnly("noresults");
            } else {
                renderResults(filtered);
            }
        }
    }

    searchInput.addEventListener("input", (e) => {
        clearTimeout(debounceId);
        const value = e.target.value;
        debounceId = setTimeout(() => search(value), 300);
    });
})();

// ============== ROBUX DROPDOWN (navbar) ==============
(function () {
    const btn = document.getElementById("robuxMenuBtn");
    const mobileBtn = document.querySelector("#navbar-stream button");
    const dropdown = document.getElementById("robuxDropdown");
    if (!btn || !dropdown) return;
    const originalParent = dropdown.parentElement;
    const mobileQuery = window.matchMedia("(max-width: 1024px)");

    function isMobileHeader() {
        return mobileQuery.matches;
    }

    function syncDropdownHost() {
        if (isMobileHeader()) {
            if (dropdown.parentElement !== document.body) {
                document.body.appendChild(dropdown);
            }
            dropdown.classList.add("robux-dropdown-mobile");
            if (mobileBtn) mobileBtn.setAttribute("aria-expanded", String(!dropdown.hidden));
            return;
        }

        if (originalParent && dropdown.parentElement !== originalParent) {
            originalParent.appendChild(dropdown);
        }
        dropdown.classList.remove("robux-dropdown-mobile");
        if (mobileBtn) mobileBtn.setAttribute("aria-expanded", "false");
    }

    function open() {
        syncDropdownHost();
        dropdown.hidden = false;
        btn.setAttribute("aria-expanded", "true");
        if (mobileBtn) mobileBtn.setAttribute("aria-expanded", "true");
    }
    function close() {
        dropdown.hidden = true;
        btn.setAttribute("aria-expanded", "false");
        if (mobileBtn) mobileBtn.setAttribute("aria-expanded", "false");
    }
    function isOpen() {
        return !dropdown.hidden;
    }

    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        isOpen() ? close() : open();
    });

    if (mobileBtn) {
        mobileBtn.setAttribute("aria-haspopup", "true");
        mobileBtn.setAttribute("aria-controls", "robuxDropdown");
        mobileBtn.addEventListener("click", (e) => {
            if (!isMobileHeader()) return;
            e.preventDefault();
            e.stopPropagation();
            isOpen() ? close() : open();
        });
    }

    // Close on outside click
    document.addEventListener("click", (e) => {
        if (!isOpen()) return;
        if (dropdown.contains(e.target) || btn.contains(e.target) || (mobileBtn && mobileBtn.contains(e.target))) return;
        close();
    });

    document.addEventListener("pointerdown", (e) => {
        if (!isOpen()) return;
        if (dropdown.contains(e.target) || btn.contains(e.target) || (mobileBtn && mobileBtn.contains(e.target))) return;
        close();
    }, true);

    // Close on Escape
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && isOpen()) close();
    });

    // Close after clicking any item (so data-go-to lands on the new tab without the menu still open)
    dropdown.querySelectorAll(".robux-dropdown-item").forEach((item) => {
        item.addEventListener("click", () => close());
    });

    syncDropdownHost();
    window.addEventListener("resize", syncDropdownHost);
})();

// ============== PAGO ==============
(function () {
    const pagoSection = document.getElementById("pago");
    if (!pagoSection) return;

    const pkgButtons = document.querySelectorAll("[data-pkg-amount]");
    const viewMain = pagoSection.querySelector('[data-view="main"]');
    const viewVerify = pagoSection.querySelector('[data-view="verify"]');
    const viewSuccess = pagoSection.querySelector('[data-view="success"]');
    const continueBtn = pagoSection.querySelector('[data-action="continue"]');
    const verifyBtn = pagoSection.querySelector('[data-action="verify"]');
    const backLink = pagoSection.querySelector('[data-action="back-to-main"]');
    const methodButtons = pagoSection.querySelectorAll(".pago-method");
    const pinInputs = pagoSection.querySelectorAll(".pago-pin");
    const quickPayOverlay = document.getElementById("quickPayOverlay");
    const quickPayClose = document.getElementById("quickPayClose");
    const quickPayCancel = document.getElementById("quickPayCancel");
    const quickPaySubmit = document.getElementById("quickPaySubmit");
    const purchaseMessageOverlay = document.getElementById("purchaseMessageOverlay");
    const purchaseMessageAccept = document.getElementById("purchaseMessageAccept");

    const METHOD_LABELS = {
        card: "Tarjeta de crédito o débito",
        paypal: "Paypal",
        redeem: "Canjear tarjetas de Roblox",
        other: "Otro",
    };

    function formatNum(n) {
        return Number(n || 0).toLocaleString("en-US");
    }

    function parseCopPrice(price) {
        if (typeof price === "number") return price;
        const str = String(price || "").replace(/\$/g, "").trim();
        const num = parseFloat(str);
        return isNaN(num) ? 0 : num;
    }

    function formatCopShort(value, options = {}) {
        const amount = Number(value || 0);
        if (amount >= 1000000) {
            return `${(amount / 1000000).toLocaleString("es-CO", {
                minimumFractionDigits: options.megaDigits ?? 4,
                maximumFractionDigits: options.megaDigits ?? 4,
            })} M COP`;
        }
        return `${(amount / 1000).toLocaleString("es-CO", {
            minimumFractionDigits: options.milDigits ?? 1,
            maximumFractionDigits: options.milDigits ?? 1,
        })} mil COP`;
    }

    function productTitle(pkg) {
        if (pkg.type === "subscription") return pkg.name || "Roblox Plus";
        return `${formatNum(pkg.amount).replace(/,/g, "")} Robux`;
    }

    function activatePagoSection() {
        document.querySelectorAll(".tab").forEach((tab) => {
            tab.classList.toggle("active", tab.dataset.tab === "pago");
        });
        document.querySelectorAll(".section").forEach((section) => {
            section.classList.toggle("section-active", section.id === "pago");
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function showView(name) {
        viewMain.hidden = name !== "main";
        viewVerify.hidden = name !== "verify";
        viewSuccess.hidden = name !== "success";
    }

    // Estado del paquete seleccionado (para acreditar el bonus al verificar)
    let currentPkg = { amount: 0, bonus: 0, type: "package", name: "", price: 0 };
    let quickPayTimer = null;

    function setGooglePayState(state) {
        if (!quickPayOverlay) return;
        quickPayOverlay.querySelectorAll("[data-google-pay-state]").forEach((el) => {
            el.hidden = el.dataset.googlePayState !== state;
        });
    }

    function formatGooglePrice(value) {
        const num = Number(value || 0);
        return `$${num.toFixed(2)}`;
    }

    function stableGoogleCardLast4(seed) {
        const text = String(seed || "roblox-user");
        let hash = 0;
        for (let i = 0; i < text.length; i += 1) {
            hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
        }
        return String(1000 + (Math.abs(hash) % 9000));
    }

    function showPurchaseMessage() {
        if (!purchaseMessageOverlay) return;
        purchaseMessageOverlay.classList.add("open");
        purchaseMessageOverlay.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        if (purchaseMessageAccept) purchaseMessageAccept.focus();
    }

    function closePurchaseMessage() {
        if (!purchaseMessageOverlay) return;
        purchaseMessageOverlay.classList.remove("open");
        purchaseMessageOverlay.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
    }

    function openQuickPay(btn) {
        if (!quickPayOverlay) return;
        if (quickPayTimer) clearTimeout(quickPayTimer);
        const amount = parseInt(btn.dataset.pkgAmount, 10) || 0;
        const bonus = parseInt(btn.dataset.pkgBonus, 10) || 0;
        const type = btn.dataset.pkgType || "package";
        const name = btn.dataset.pkgName || "";
        const price = parseCopPrice(btn.dataset.pkgPrice);
        currentPkg = { amount, bonus, type, name, price };

        const titleEl = quickPayOverlay.querySelector("[data-quick-pay-title]");
        const priceEl = quickPayOverlay.querySelector("[data-quick-pay-price]");
        const subtotalEl = quickPayOverlay.querySelector("[data-quick-pay-subtotal]");
        const taxEl = quickPayOverlay.querySelector("[data-quick-pay-tax]");
        const totalEl = quickPayOverlay.querySelector("[data-quick-pay-total]");
        const cardLabelEl = quickPayOverlay.querySelector("[data-google-pay-card-label]");
        const formattedPrice = formatGooglePrice(price);

        const normalView = document.getElementById("quickPayNormalView");
        const splitView = document.getElementById("quickPaySplitView");
        const splitRobuxTitle = document.getElementById("quickPaySplitRobuxTitle");
        const splitRobuxPrice = document.getElementById("quickPaySplitRobuxPrice");
        const quickPayItemImg = document.getElementById("quickPayItemImg");
        const quickPayItemName = document.getElementById("quickPayItemName");

        const itemName = btn.dataset.pkgItemName || "";
        const itemImg = btn.dataset.pkgItemImg || "";

        if (itemName && itemImg) {
            // Mostrar vista dividida (Robux + Item)
            if (normalView) normalView.style.display = "none";
            if (splitView) splitView.style.display = "flex";
            if (splitRobuxTitle) splitRobuxTitle.textContent = productTitle(currentPkg);
            if (splitRobuxPrice) splitRobuxPrice.textContent = formattedPrice;
            if (quickPayItemImg) quickPayItemImg.src = itemImg;
            if (quickPayItemName) quickPayItemName.textContent = itemName;
        } else {
            // Mostrar vista normal (Solo Robux)
            if (normalView) normalView.style.display = "contents";
            if (splitView) splitView.style.display = "none";
            if (titleEl) titleEl.textContent = productTitle(currentPkg);
            if (priceEl) priceEl.textContent = formattedPrice;
        }

        if (subtotalEl) subtotalEl.textContent = formattedPrice;
        if (taxEl) taxEl.textContent = "$0.00";
        if (totalEl) totalEl.textContent = formattedPrice;
        if (cardLabelEl) {
            const sess = getSession();
            const last4 = (sess && sess.cardLast4) || "6450";
            cardLabelEl.textContent = `****${last4}`;
        }
        setGooglePayState("purchase");

        quickPayOverlay.classList.add("open");
        quickPayOverlay.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        if (quickPaySubmit) quickPaySubmit.focus();
    }

    function closeQuickPay() {
        if (!quickPayOverlay) return;
        if (quickPayTimer) {
            clearTimeout(quickPayTimer);
            quickPayTimer = null;
        }
        quickPayOverlay.classList.remove("paying");
        quickPayOverlay.classList.remove("open");
        quickPayOverlay.classList.remove("blackout");
        quickPayOverlay.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
        if (quickPaySubmit) quickPaySubmit.disabled = false;
        const loader = quickPayOverlay.querySelector(".quick-pay-loader");
        if (loader) loader.hidden = true;
        setGooglePayState("purchase");
    }

    function activatePurchaseResult() {
        const resultSection = document.getElementById("purchase-result");
        if (!resultSection) return;
        const amountLabel = resultSection.querySelector("[data-purchase-result-amount]");
        if (amountLabel) amountLabel.textContent = productTitle(currentPkg);
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
        document.querySelectorAll(".section").forEach((section) => {
            section.classList.toggle("section-active", section.id === "purchase-result");
        });
        requestAnimationFrame(() => {
            window.scrollTo({ top: 0, left: 0, behavior: "auto" });
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
        });
    }

    if (purchaseMessageAccept) purchaseMessageAccept.addEventListener("click", closePurchaseMessage);
    if (purchaseMessageOverlay) {
        purchaseMessageOverlay.addEventListener("click", (e) => {
            if (e.target === purchaseMessageOverlay) closePurchaseMessage();
        });
    }
    if (quickPayClose) quickPayClose.addEventListener("click", closeQuickPay);
    if (quickPayCancel) quickPayCancel.addEventListener("click", closeQuickPay);
    if (quickPayOverlay) {
        quickPayOverlay.addEventListener("click", (e) => {
            if (e.target === quickPayOverlay) closeQuickPay();
        });
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && quickPayOverlay.classList.contains("open")) closeQuickPay();
        });
    }
    if (quickPaySubmit) {
        quickPaySubmit.addEventListener("click", () => {
            if (quickPayTimer) clearTimeout(quickPayTimer);
            quickPaySubmit.disabled = true;
            quickPayOverlay.classList.add("paying");
            const loader = quickPayOverlay.querySelector(".quick-pay-loader");
            if (loader) loader.hidden = false;
            quickPayTimer = setTimeout(() => {
                const totalRobux = (currentPkg.amount || 0) + (currentPkg.bonus || 0);
                const txDesc = currentPkg.type === "subscription" ? `Suscripción ${currentPkg.name || "Roblox Plus"}` : "Compra de Robux";
                if (totalRobux > 0) addTransaction("in", totalRobux, txDesc);
                quickPaySubmit.disabled = false;
                closeQuickPay();
                activatePurchaseResult();
            }, 2000);
        });
    }

    // 1. Click en un package → muestra overlay de carga 1s y luego abre Pago rapido
    pkgButtons.forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            // Mostrar overlay de carga durante 1 segundo antes de abrir el modal
            const buyOverlay = document.getElementById("buyLoadingOverlay");
            if (buyOverlay) {
                buyOverlay.classList.add("active");
                buyOverlay.setAttribute("aria-hidden", "false");
                setTimeout(function () {
                    buyOverlay.classList.remove("active");
                    buyOverlay.setAttribute("aria-hidden", "true");
                    openQuickPay(btn);
                }, 1000);
            } else {
                openQuickPay(btn);
            }
            return;
            // Si el botón no estaba en un .package-row, igual leemos data-attrs
            const amount = parseInt(btn.dataset.pkgAmount, 10) || 0;
            const old = btn.dataset.pkgOld;
            const price = btn.dataset.pkgPrice;
            const bonus = parseInt(btn.dataset.pkgBonus, 10) || 0;
            const type = btn.dataset.pkgType || "package";
            const name = btn.dataset.pkgName || "";

            // Guardar en el estado del pago para usarlo al verificar
            currentPkg = { amount, bonus, type, name };

            pagoSection.querySelector("[data-pago-amount]").textContent = formatNum(amount);
            const oldEl = pagoSection.querySelector("[data-pago-old]");
            if (oldEl) {
                if (old && parseInt(old, 10) > 0) {
                    oldEl.style.display = "inline";
                    oldEl.textContent = formatNum(old);
                } else {
                    oldEl.style.display = "none";
                }
            }

            const formattedPrice = isNaN(price) || isNaN(parseFloat(price)) ? price : `EUR ${parseFloat(price).toFixed(2)}`;
            pagoSection.querySelector("[data-pago-price]").textContent = formattedPrice;

            const bonusEl = pagoSection.querySelector("[data-pago-bonus]");
            if (bonusEl) {
                if (bonus > 0) {
                    bonusEl.style.display = "inline-block";
                    bonusEl.textContent = `+${formatNum(bonus)} bonificación`;
                } else {
                    bonusEl.style.display = "none";
                }
            }

            // Objeto de bonificación / Suscripción Info
            const bonusCard = pagoSection.querySelector(".pago-bonus-card");
            if (bonusCard) {
                if (type === "subscription") {
                    bonusCard.style.display = "flex";
                    bonusCard.querySelector(".pago-bonus-img").src = "recursos/Robux.webp";
                    bonusCard.querySelector(".pago-bonus-title").textContent = "Suscripción Activa";
                    bonusCard.querySelector(".pago-bonus-sub").textContent = `Planes mensuales de Roblox Plus (${name})`;
                } else if (btn.dataset.pkgItemName && btn.dataset.pkgItemImg) {
                    bonusCard.style.display = "flex";
                    bonusCard.querySelector(".pago-bonus-img").src = btn.dataset.pkgItemImg;
                    bonusCard.querySelector(".pago-bonus-title").textContent = "Objeto de bonificación gratis";
                    bonusCard.querySelector(".pago-bonus-sub").textContent = btn.dataset.pkgItemName;
                } else {
                    bonusCard.style.display = "none";
                }
            }

            showView("main");
            // Reset PIN
            pinInputs.forEach((i) => { i.value = ""; i.classList.remove("filled"); });
            verifyBtn.disabled = true;
        });
    });

    // 2. Selección de método de pago
    methodButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            methodButtons.forEach((b) => {
                b.classList.remove("selected");
                b.setAttribute("aria-checked", "false");
            });
            btn.classList.add("selected");
            btn.setAttribute("aria-checked", "true");
            const method = btn.dataset.method;
            pagoSection.querySelector("[data-pago-method-label]").textContent = METHOD_LABELS[method] || "Paypal";
        });
    });

    // 3. Continuar → ir a verify (con spinner de carga leve)
    continueBtn.addEventListener("click", () => {
        setButtonLoading(continueBtn, true, "Procesando...");
        setTimeout(() => {
            setButtonLoading(continueBtn, false);
            // Personalizar el correo enmascarado con la inicial del usuario
            const sess = getSession();
            const username = sess && sess.username ? sess.username : "";
            const initial = (username.charAt(0) || "u").toLowerCase();
            const emailEl = pagoSection.querySelector("[data-pago-email]");
            if (emailEl) emailEl.textContent = `${initial}***@gmail.com`;
            showView("verify");
            setTimeout(() => pinInputs[0].focus(), 150);
        }, 900);
    });

    // 4. PIN inputs: solo dígitos, auto-avanzar, manejar backspace
    pinInputs.forEach((input, idx) => {
        input.addEventListener("input", (e) => {
            const v = e.target.value.replace(/\D/g, "");
            e.target.value = v;
            if (v) {
                input.classList.add("filled");
                if (idx < pinInputs.length - 1) pinInputs[idx + 1].focus();
            } else {
                input.classList.remove("filled");
            }
            // Habilitar verify cuando los 6 estén llenos
            const allFilled = Array.from(pinInputs).every((i) => i.value.length === 1);
            verifyBtn.disabled = !allFilled;
        });
        input.addEventListener("keydown", (e) => {
            if (e.key === "Backspace" && !e.target.value && idx > 0) {
                pinInputs[idx - 1].focus();
            } else if (e.key === "ArrowLeft" && idx > 0) {
                pinInputs[idx - 1].focus();
            } else if (e.key === "ArrowRight" && idx < pinInputs.length - 1) {
                pinInputs[idx + 1].focus();
            }
        });
        input.addEventListener("paste", (e) => {
            const data = (e.clipboardData || window.clipboardData).getData("text").replace(/\D/g, "").slice(0, 6);
            if (data) {
                e.preventDefault();
                data.split("").forEach((ch, i) => {
                    if (pinInputs[i]) {
                        pinInputs[i].value = ch;
                        pinInputs[i].classList.add("filled");
                    }
                });
                const allFilled = Array.from(pinInputs).every((i) => i.value.length === 1);
                verifyBtn.disabled = !allFilled;
                (pinInputs[Math.min(data.length, pinInputs.length - 1)]).focus();
            }
        });
    });

    // 5. Verificar → success → volver a Robux (con spinner de carga)
    verifyBtn.addEventListener("click", () => {
        setButtonLoading(verifyBtn, true, "Verificando...");
        setTimeout(() => {
            setButtonLoading(verifyBtn, false);
            // Usar los datos del paquete seleccionado (incluye el bonus)
            const amount = currentPkg.amount || 0;
            const bonus = currentPkg.bonus || 0;
            const total = amount + bonus;
            const type = currentPkg.type || "package";
            const name = currentPkg.name || "";

            const succAmount = viewSuccess.querySelector("[data-pago-amount]");
            if (succAmount) succAmount.textContent = formatNum(total);
            
            // Actualizar el mensaje de éxito con el desglose o la suscripción
            const succMsg = viewSuccess.querySelector("[data-pago-success-msg]");
            if (succMsg) {
                if (type === "subscription") {
                    succMsg.innerHTML = `Tu suscripción a <strong>${name}</strong> ha sido activada con éxito. ${total > 0 ? `Se han abonado <strong>${formatNum(total)} Robux</strong> a tu cuenta.` : ""} Serás redirigido a la sección Robux.`;
                } else {
                    if (bonus > 0) {
                        succMsg.innerHTML = `Tus <strong>${formatNum(amount)} Robux</strong> + <strong>${formatNum(bonus)} de bonificación</strong> = <strong>${formatNum(total)} Robux</strong> han sido añadidos a tu cuenta. Serás redirigido a la sección Robux.`;
                    } else {
                        succMsg.innerHTML = `Tus <strong>${formatNum(total)} Robux</strong> han sido añadidos a tu cuenta. Serás redirigido a la sección Robux.`;
                    }
                }
            }
            // Sumar al balance y registrar transacción entrante
            const txDesc = type === "subscription" ? `Suscripción ${name}` : "Compra de Robux";
            addTransaction("in", total, txDesc);
            
            showView("success");
            setTimeout(() => {
                const robuxTab = document.querySelector('.tab[data-tab="robux"]');
                if (robuxTab) robuxTab.click();
            }, 2500);
        }, 1100);
    });

    // 6. Back link
    backLink.addEventListener("click", () => {
        showView("main");
    });
})();

// ============== LOGIN MODAL ==============
(function () {
    const overlay = document.getElementById("loginModal");
    const openBtn = document.getElementById("openLoginModal");
    const closeBtn = document.getElementById("closeLoginModal");
    const submitBtn = document.getElementById("loginSubmitBtn");
    if (!overlay || !openBtn) return;

    function open() {
        overlay.classList.add("open");
        overlay.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        setTimeout(() => {
            const input = overlay.querySelector(".login-input");
            if (input) input.focus();
        }, 200);
    }
    function close() {
        overlay.classList.remove("open");
        overlay.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
    }

    openBtn.addEventListener("click", open);
    if (closeBtn) closeBtn.addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) close();
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && overlay.classList.contains("open")) close();
    });

    // Submit demo: show spinner, close, toast
    if (submitBtn) {
        submitBtn.addEventListener("click", () => {
            setButtonLoading(submitBtn, true, "Iniciando...");
            setTimeout(() => {
                setButtonLoading(submitBtn, false);
                close();
                showToast("Demo: inicio de sesión simulado");
            }, 900);
        });
    }

    // Limpiar mensaje de error al escribir en los inputs
    overlay.querySelectorAll(".login-input").forEach((inp) => {
        inp.addEventListener("input", () => {
            const err = document.getElementById("loginErrorMsg");
            if (err && !err.hidden) {
                err.hidden = true;
                err.innerHTML = "";
            }
        });
    });
})();

// ============== FIREBASE + AUTH + ADMIN ==============
(function () {
    if (!window.firebase || !window.__firebaseConfig) return;

    try {
        firebase.initializeApp(window.__firebaseConfig);
    } catch (e) {
        console.error("Firebase init error:", e);
        return;
    }
    const rtdb = firebase.database();
    const auth = firebase.auth();

    // ============== Password hashing (SHA-256 + salt) ==============
    const SALT = "roblox-clone-salt-2024";
    async function hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password + SALT);
        const hash = await crypto.subtle.digest("SHA-256", data);
        return Array.from(new Uint8Array(hash))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
    }

    // ============== Session ==============
    // SESSION_KEY y getSession() están definidos globalmente arriba
    // (para que sean accesibles desde otros IIFEs, como el de PAGO)
    // Máximo de sesiones simultáneas por usuario (protege contra
    // que varias personas compartan la misma cuenta)
    const SESSIONS_MAX = 1;
    // Si una sesión no manda heartbeat en este tiempo, se considera
    // muerta y se libera el slot (5 min)
    const SESSION_TTL = 5 * 60 * 1000;
    // Cada cuánto se manda el heartbeat
    const HEARTBEAT_INTERVAL = 60 * 1000;

    function setSession(user) {
        const session = {
            username: user.username,
            role: user.role,
            authProvider: user.authProvider || (user.role === "admin" ? "firebase" : "rtdb"),
            avatar: user.avatar || DEFAULT_AVATAR,
            cardLast4: user.cardLast4 || stableCardLast4(user.username),
            sessionId: user.sessionId || (crypto.randomUUID && crypto.randomUUID()) || (Date.now() + "-" + Math.random().toString(36).slice(2)),
            expiresAt: user.expiresAt ? (user.expiresAt.toMillis ? user.expiresAt.toMillis() : new Date(user.expiresAt).getTime()) : null,
            loggedInAt: Date.now(),
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        return session;
    }
    function clearSession() {
        const sess = getSession();
        // Limpiar la sesión activa de RTDB
        if (sess && sess.sessionId && rtdb) {
            try { rtdb.ref("sessions/" + sessionKey(sess.username) + "/" + sess.sessionId).remove(); } catch (_) {}
        }
        localStorage.removeItem(SESSION_KEY);
    }
    function isSessionValid(session) {
        if (!session) return false;
        if (!session.expiresAt) return false;
        return session.expiresAt > Date.now();
    }

    // ============== Gestión de sesiones activas en RTDB ==============
    // Estructura:
    //   sessions/
    //     {username}/
    //       {sessionId}/
    //         createdAt: number
    //         lastSeen:  number
    //         userAgent: string
    function generateSessionId() {
        if (crypto && crypto.randomUUID) return crypto.randomUUID();
        return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
    }
    function sessionKey(username) {
        return sanitizeKey(username);
    }
    async function registerSession(username, sessionId) {
        await rtdb.ref("sessions/" + sessionKey(username) + "/" + sessionId).set({
            createdAt: Date.now(),
            lastSeen: Date.now(),
            username,
            userAgent: (navigator.userAgent || "").slice(0, 100),
        });
    }
    // Forzar logout del usuario actual (por cuenta eliminada, expirada, etc.)
    function forceLogout(reason) {
        const sess = getSession();
        if (!sess) return;
        console.warn("[auth] Forzando logout:", reason);
        stopHeartbeat();
        clearSession();
        updateAuthUI();
        // Volver a Destacadas
        const tab = document.querySelector('.tab[data-tab="destacadas"]');
        if (tab) tab.click();
        // Reabrir el modal de login y mostrar el mensaje de error
        // (se hace en el siguiente tick para que el modal esté listo)
        setTimeout(() => {
            const loginOverlay = document.getElementById("loginModal");
            if (loginOverlay) {
                loginOverlay.classList.add("open");
                loginOverlay.setAttribute("aria-hidden", "false");
                document.body.style.overflow = "hidden";
            }
            if (typeof showLoginError === "function") {
                showLoginError(
                    `<strong>Sesión cerrada</strong>${escapeHtml(reason || "Tu cuenta ya no está disponible.")}`
                );
            } else {
                showToast(reason || "Sesión cerrada");
            }
        }, 50);
    }

    async function heartbeatSession(username, sessionId) {
        if (!username || !sessionId) return;
        try {
            // 1) Actualizar el heartbeat
            await rtdb.ref("sessions/" + sessionKey(username) + "/" + sessionId + "/lastSeen").set(Date.now());
        } catch (_) { /* ignore write errors */ }

        // 2) Verificar que el usuario aún existe (si está en RTDB)
        // Para usuarios de Auth (admin), saltamos esta verificación
        const currentSession = getSession();
        const shouldVerifyRtdbUser = currentSession
            && currentSession.username === username
            && currentSession.authProvider !== "firebase"
            && currentSession.role !== "admin";
        if (!shouldVerifyRtdbUser) return;

        try {
            const safeKey = sanitizeKey(username);
            const snap = await rtdb.ref("users/" + safeKey).once("value");
            if (!snap.exists()) {
                // El usuario fue eliminado del admin panel
                forceLogout(`La cuenta "${username}" fue eliminada por el administrador.`);
                return;
            }
            const data = snap.val();
            if (data && data.expiresAt && Number(data.expiresAt) < Date.now()) {
                forceLogout(`La cuenta "${username}" ha expirado.`);
                return;
            }
        } catch (_) {
            // Si falla la lectura, no cerramos la sesión (puede ser
            // un problema de red transitorio)
        }
    }
    async function unregisterSession(username, sessionId) {
        if (!username || !sessionId) return;
        try { await rtdb.ref("sessions/" + sessionKey(username) + "/" + sessionId).remove(); } catch (_) {}
    }
    async function countActiveSessions(username) {
        try {
            const snap = await rtdb.ref("sessions/" + sessionKey(username)).once("value");
            if (!snap.exists()) return 0;
            const now = Date.now();
            let count = 0;
            snap.forEach((child) => {
                const data = child.val();
                if (data && (now - (data.lastSeen || 0)) < SESSION_TTL) count++;
            });
            return count;
        } catch (_) { return 0; }
    }
    async function cleanStaleSessions(username) {
        try {
            const snap = await rtdb.ref("sessions/" + sessionKey(username)).once("value");
            if (!snap.exists()) return;
            const now = Date.now();
            const updates = {};
            snap.forEach((child) => {
                const data = child.val();
                if (!data || (now - (data.lastSeen || 0)) >= SESSION_TTL) {
                    updates[child.key] = null;
                }
            });
            if (Object.keys(updates).length > 0) {
                await rtdb.ref("sessions/" + sessionKey(username)).update(updates);
            }
        } catch (_) {}
    }
    async function getActiveSessionList(username) {
        try {
            const snap = await rtdb.ref("sessions/" + sessionKey(username)).once("value");
            if (!snap.exists()) return [];
            const now = Date.now();
            const list = [];
            snap.forEach((child) => {
                const data = child.val();
                if (data && (now - (data.lastSeen || 0)) < SESSION_TTL) {
                    list.push({ id: child.key, ...data });
                }
            });
            return list;
        } catch (_) { return []; }
    }

    let heartbeatTimer = null;
    function startHeartbeat(username, sessionId) {
        stopHeartbeat();
        heartbeatTimer = setInterval(() => heartbeatSession(username, sessionId), HEARTBEAT_INTERVAL);
    }
    function stopHeartbeat() {
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
        }
    }

    // Cuando el usuario cierra la pestaña, intentar limpiar la sesión
    // (best-effort: si el navegador no lo ejecuta, la sesión expira
    // automáticamente por inactividad de heartbeat en SESSION_TTL)
    window.addEventListener("pagehide", () => {
        const sess = getSession();
        if (sess && sess.sessionId && rtdb) {
            try {
                rtdb.ref("sessions/" + sessionKey(sess.username) + "/" + sess.sessionId).remove();
            } catch (_) {}
        }
    });

    // Cuando la pestaña recupera foco o se vuelve visible, verificar
    // que la sesión sigue siendo válida (no fue revocada por el admin).
    async function validateSessionOnFocus() {
        const sess = getSession();
        if (!sess || !isSessionValid(sess)) return;
        // Verificar heartbeat inmediatamente
        if (sess.sessionId) {
            await heartbeatSession(sess.username, sess.sessionId);
        }
    }
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            validateSessionOnFocus();
        }
    });
    window.addEventListener("focus", validateSessionOnFocus);

    // ============== User CRUD (Firebase Realtime Database) ==============
    // Estructura RTDB:
    //   users/
    //     {username}/
    //       username: string
    //       passwordHash: string
    //       role: "admin" | "user"
    //       createdAt: number (Unix ms)
    //       expiresAt: number (Unix ms)

    function tsToMs(ts) {
        if (ts == null) return null;
        if (typeof ts === "number") return ts;
        return ts;
    }

    function randomCardLast4() {
        return String(Math.floor(1000 + Math.random() * 9000));
    }

    function stableCardLast4(seed) {
        const text = String(seed || "roblox-user");
        let hash = 0;
        for (let i = 0; i < text.length; i += 1) {
            hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
        }
        return String(1000 + (Math.abs(hash) % 9000));
    }

    // RTDB no permite los caracteres  . # $ [ ]  en las keys de los paths.
    // Sanitizamos el username para usarlo como key, pero conservamos el
    // username ORIGINAL en el documento (es lo que ve el admin y lo que
    // usa el login para resolver el hash de la contraseña).
    function sanitizeKey(name) {
        return String(name || "").replace(/[.#$\[\]@/]/g, "_");
    }

    async function findUser(username) {
        try {
            const key = sanitizeKey(username);
            const snap = await rtdb.ref("users/" + key).once("value");
            return snap.exists() ? { id: snap.key, ...snap.val() } : null;
        } catch (e) {
            console.error("findUser error:", e);
            return null;
        }
    }
    async function createUser({ username, password, role, daysValid, avatar }) {
        const passwordHash = await hashPassword(password);
        const now = Date.now();
        const expiresAt = now + daysValid * 24 * 60 * 60 * 1000;
        const user = {
            username,
            passwordHash,
            role: role || "user",
            avatar: avatar || "1.webp",
            cardLast4: randomCardLast4(),
            createdAt: now,
            expiresAt: expiresAt,
        };
        await rtdb.ref("users/" + sanitizeKey(username)).set(user);
        return user;
    }
    async function listUsers() {
        try {
            const snap = await rtdb.ref("users").orderByChild("createdAt").once("value");
            const list = [];
            snap.forEach((child) => {
                list.push({ id: child.key, ...child.val() });
            });
            // Ordenar de más nuevo a más viejo
            list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            return list;
        } catch (e) {
            console.error("listUsers error:", e);
            return [];
        }
    }
    async function deleteUser(username) {
        const key = sanitizeKey(username);
        await rtdb.ref("users/" + key).remove();
        try {
            await rtdb.ref("sessions/" + sessionKey(username)).remove();
        } catch (_) {}
    }
    async function resetUserDevice(username) {
        const key = sanitizeKey(username);
        // 1. Eliminar la vinculación del dispositivo en RTDB
        await rtdb.ref("users/" + key + "/deviceId").remove();
        // 2. Eliminar todas las sesiones activas asociadas a la cuenta para cerrar sesión en el dispositivo previo
        try {
            await rtdb.ref("sessions/" + sessionKey(username)).remove();
        } catch (_) {}
    }

    // ============== Auth UI updates ==============
    function updateAuthUI() {
        const session = getSession();
        const valid = isSessionValid(session);
        const loginTrigger = document.getElementById("openLoginModal");
        const profileChip = document.querySelector(".age-bracket-label");
        const adminTab = document.querySelector(".tab-admin");

        if (valid && session) {
            // Logged in
            // Iniciar el heartbeat para mantener la sesión activa en RTDB
            if (session.sessionId) {
                startHeartbeat(session.username, session.sessionId);
            }
            if (loginTrigger) loginTrigger.hidden = true;
            if (profileChip) {
                profileChip.style.display = "";
            }
            
            // Actualizar todos los nombres de usuario en la UI
            const nameEls = document.querySelectorAll(".user-username-text");
            nameEls.forEach((el) => {
                el.textContent = session.username;
            });
            
            // Actualizar todos los avatares en la UI
            const avatarImgs = document.querySelectorAll(".user-avatar-img");
            const showAvatar = (avatarName) => {
                avatarImgs.forEach((img) => {
                    img.onerror = () => {
                        img.onerror = null;
                        img.src = "recursos/iconos/" + DEFAULT_AVATAR;
                        img.style.display = "";
                    };
                    img.src = "recursos/iconos/" + (avatarName || DEFAULT_AVATAR);
                    img.style.display = "";
                });
            };

            showAvatar(session.avatar);
            if (!session.avatar || session.avatar === DEFAULT_AVATAR) {
                findUser(session.username).then((u) => {
                    if (u && u.avatar) {
                        session.avatar = u.avatar;
                        setSession(session);
                        showAvatar(u.avatar);
                    }
                }).catch(() => {});
            }

            if (adminTab && session.role === "admin") {
                adminTab.hidden = false;
                adminTab.classList.add("visible");
            } else if (adminTab) {
                adminTab.hidden = true;
                adminTab.classList.remove("visible");
            }
        } else {
            // Not logged in / expired
            clearSession();
            if (loginTrigger) loginTrigger.hidden = false;
            if (profileChip) {
                profileChip.style.display = "none";
            }
            if (adminTab) {
                adminTab.hidden = true;
                adminTab.classList.remove("visible");
            }
        }
    }

    // ============== Sign in (override the demo submit) ==============
    const submitBtn = document.getElementById("loginSubmitBtn");
    if (submitBtn) {
        // Replace the existing click handler from the login modal IIFE
        // by adding a new one (we'll detect and override below)
        const newSubmit = async () => {
            const inputs = document.querySelectorAll("#loginModal .login-input");
            const identifier = (inputs[0]?.value || "").trim();
            const password = inputs[1]?.value || "";
            if (!identifier || !password) {
                showToast("Ingresa usuario/correo y contraseña");
                return;
            }
            setButtonLoading(submitBtn, true, "Iniciando...");
            const closeAndWelcome = (user) => {
                const overlay = document.getElementById("loginModal");
                if (overlay) {
                    // Mover el foco fuera del modal ANTES de ocultarlo
                    // para evitar el warning de aria-hidden + focus retenido
                    if (document.activeElement && overlay.contains(document.activeElement)) {
                        document.activeElement.blur();
                    }
                    overlay.classList.remove("open");
                    overlay.setAttribute("aria-hidden", "true");
                    document.body.style.overflow = "";
                    inputs.forEach((i) => (i.value = ""));
                }
                const name = user.displayName || user.username || "admin";
                showToast(`Bienvenido, ${name}`);
            };

            // Helper: verificar límite de sesiones activas y vinculación de dispositivo
            // Si el usuario ya tiene SESSIONS_MAX sesiones o está vinculado a otro dispositivo, se rechaza el login
            // Si el rol es admin, se permite multidispositivo sin límite de sesiones ni vinculación.
            const enforceSessionLimit = async (username, incomingSessionId, role) => {
                if (role === "admin") {
                    return { ok: true, sessionId: incomingSessionId };
                }
                
                // --- Device Binding Check ---
                let deviceId = localStorage.getItem("amenzaa_device_id");
                if (!deviceId) {
                    deviceId = "dev_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
                    localStorage.setItem("amenzaa_device_id", deviceId);
                }
                
                try {
                    const safeKey = sanitizeKey(username);
                    const snap = await rtdb.ref("users/" + safeKey + "/deviceId").once("value");
                    if (snap.exists()) {
                        const boundDeviceId = snap.val();
                        if (boundDeviceId !== deviceId) {
                            return { ok: false, deviceBound: true };
                        }
                    } else {
                        // Vincular este dispositivo a la cuenta
                        await rtdb.ref("users/" + safeKey + "/deviceId").set(deviceId);
                    }
                } catch (e) {
                    console.error("[auth] device-bind check FAILED:", e.message);
                    // Si falla la lectura por reglas o red, bloqueamos por seguridad
                    return { ok: false, deviceBound: true };
                }

                try {
                    await cleanStaleSessions(username);
                    const list = await getActiveSessionList(username);
                    console.log("[auth] session-limit check for", username, "→ active sessions:", list.length, list.map(s => s.id.slice(0,8)));
                    const alreadyRegistered = list.some((s) => s.id === incomingSessionId);
                    if (alreadyRegistered) return { ok: true, sessionId: incomingSessionId };
                    if (list.length >= SESSIONS_MAX) {
                        return {
                            ok: false,
                            activeSessions: list.length,
                            otherSessionIds: list.map((s) => s.id),
                            deviceBound: false
                        };
                    }
                    return { ok: true, sessionId: incomingSessionId };
                } catch (e) {
                    console.error("[auth] session-limit check FAILED (¿reglas de RTDB sin acceso a /sessions?):", e.message);
                    // Si falla (permisos, red), dejamos pasar pero logueamos
                    return { ok: true, sessionId: incomingSessionId };
                }
            };

            // Helper: procesar un usuario de RTDB
            const handleRtdbUser = async (rtdbUser) => {
                const expiresMs = Number(rtdbUser.expiresAt) || 0;
                if (expiresMs < Date.now()) {
                    setButtonLoading(submitBtn, false);
                    showLoginError(`<strong>Cuenta expirada</strong>Esta cuenta ya no está activa. Comunícate con el administrador para renovarla.`);
                    return false;
                }
                const newSessionId = generateSessionId();
                // Verificar el límite de sesiones (pasando el rol del usuario)
                const limit = await enforceSessionLimit(rtdbUser.username, newSessionId, rtdbUser.role || "user");
                if (!limit.ok) {
                    setButtonLoading(submitBtn, false);
                    const errorTitle = limit.deviceBound ? "Cuenta vinculada a otro dispositivo" : "Cuenta en uso en otro dispositivo";
                    const errorReason = limit.deviceBound ? "ya está vinculada a un dispositivo diferente" : "ya tiene una sesión activa";
                    showLoginError(
                        `<strong>${errorTitle}</strong>` +
                        `Esta cuenta (<code>@${escapeHtml(rtdbUser.username)}</code>) ${errorReason}. ` +
                        `Solo se permite <strong>1 dispositivo por cuenta</strong>.` +
                        `<br>Para usar esta cuenta en este dispositivo, contacta al administrador.`
                    );
                    return false;
                }
                if (!rtdbUser.cardLast4) {
                    rtdbUser.cardLast4 = randomCardLast4();
                    try {
                        await rtdb.ref("users/" + sanitizeKey(rtdbUser.username) + "/cardLast4").set(rtdbUser.cardLast4);
                    } catch (_) {}
                }
                setSession({
                    username: rtdbUser.username,
                    role: rtdbUser.role || "user",
                    authProvider: "rtdb",
                    avatar: rtdbUser.avatar || null,
                    cardLast4: rtdbUser.cardLast4,
                    sessionId: newSessionId,
                    expiresAt: expiresMs,
                });
                // Registrar la sesión en RTDB
                try { await registerSession(rtdbUser.username, newSessionId); } catch (_) {}
                setButtonLoading(submitBtn, false);
                updateAuthUI();
                closeAndWelcome({ username: rtdbUser.username });
                return true;
            };

            // Helper: procesar un usuario de Auth
            const handleAuthUser = async (authUser) => {
                let role = "admin";
                let expiresMs = Date.now() + 365 * 24 * 60 * 60 * 1000; // 1 año
                let avatar = null;
                // Buscar metadata extra en RTDB (por si el admin limitó su propia cuenta)
                try {
                    const safeKey = sanitizeKey(authUser.email);
                    const rtdbSnap = await rtdb.ref("users/" + safeKey).once("value");
                    if (rtdbSnap.exists()) {
                        const data = rtdbSnap.val();
                        if (data.role) role = data.role;
                        if (data.avatar) avatar = data.avatar;
                        if (data.expiresAt) {
                            const exp = Number(data.expiresAt) || 0;
                            if (exp < Date.now()) {
                                await auth.signOut();
                                setButtonLoading(submitBtn, false);
                                showLoginError(`<strong>Cuenta expirada</strong>Esta cuenta ya no está activa. Comunícate con el administrador para renovarla.`);
                                return false;
                            }
                            expiresMs = exp;
                        }
                    }
                } catch (_) { /* no metadata, default admin */ }
                const newSessionId = generateSessionId();
                // Verificar el límite de sesiones (pasando el rol del usuario)
                const limit = await enforceSessionLimit(authUser.email, newSessionId, role);
                if (!limit.ok) {
                    await auth.signOut();
                    setButtonLoading(submitBtn, false);
                    const errorTitle = limit.deviceBound ? "Cuenta vinculada a otro dispositivo" : "Cuenta en uso en otro dispositivo";
                    const errorReason = limit.deviceBound ? "ya está vinculada a un dispositivo diferente" : "ya tiene una sesión activa";
                    showLoginError(
                        `<strong>${errorTitle}</strong>` +
                        `Esta cuenta (<code>${escapeHtml(authUser.email)}</code>) ${errorReason}. ` +
                        `Solo se permite <strong>1 dispositivo por cuenta</strong>.` +
                        `<br>Para usar esta cuenta en este dispositivo, contacta al administrador.`
                    );
                    return false;
                }
                setSession({
                    username: authUser.email,
                    role: role,
                    authProvider: "firebase",
                    avatar: avatar,
                    sessionId: newSessionId,
                    expiresAt: expiresMs,
                });
                // Registrar la sesión en RTDB
                try { await registerSession(authUser.email, newSessionId); } catch (_) {}
                setButtonLoading(submitBtn, false);
                updateAuthUI();
                closeAndWelcome({ username: authUser.email, displayName: "admin" });
                return true;
            };

            try {
                const looksLikeEmail = identifier.includes("@");

                if (looksLikeEmail) {
                    // === EMAIL → Firebase Authentication (admin) ===
                    console.log("[auth] Trying Firebase Auth with email:", identifier);
                    try {
                        const cred = await auth.signInWithEmailAndPassword(identifier, password);
                        console.log("[auth] Auth success:", cred.user.email);
                        await handleAuthUser(cred.user);
                        return;
                    } catch (authErr) {
                        console.warn("[auth] Auth signin failed:", authErr.code, authErr.message);
                        // Si fue INVALID_LOGIN_CREDENTIALS, igual intentamos RTDB
                        // (porque el usuario pudo haber sido creado en RTDB con ese
                        // email-style como username)
                    }
                }

                // === USUARIO (sin @) o fallback → RTDB ===
                console.log("[auth] Trying RTDB with identifier:", identifier);
                const rtdbUser = await findUser(identifier);
                if (rtdbUser && rtdbUser.passwordHash) {
                    const hash = await hashPassword(password);
                    if (hash === rtdbUser.passwordHash) {
                        const ok = handleRtdbUser(rtdbUser);
                        if (ok) return;
                        return;
                    } else {
                        setButtonLoading(submitBtn, false);
                        showToast("Contraseña incorrecta");
                        return;
                    }
                }

                // Si llegamos aquí, no se encontró en ningún lado
                setButtonLoading(submitBtn, false);
                if (looksLikeEmail) {
                    showToast("No existe una cuenta con ese correo");
                } else {
                    showToast("Usuario no encontrado");
                }
            } catch (e) {
                console.error("[auth] Login error:", e);
                setButtonLoading(submitBtn, false);
                showToast("Error al iniciar sesión: " + (e.message || e));
            }
        };
        // Clone to remove any previous listener (the demo one from LOGIN MODAL IIFE)
        const newBtn = submitBtn.cloneNode(true);
        submitBtn.parentNode.replaceChild(newBtn, submitBtn);
        newBtn.addEventListener("click", newSubmit);

        // También capturar Enter en los inputs del modal
        const loginInputs = document.querySelectorAll("#loginModal .login-input");
        loginInputs.forEach((inp) => {
            inp.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    newBtn.click();
                }
            });
        });
    }

    // ============== Sign out ==============
    function signOut() {
        stopHeartbeat();
        clearSession();
        updateAuthUI();
        // Navigate to Destacadas
        const tab = document.querySelector('.tab[data-tab="destacadas"]');
        if (tab) tab.click();
        // Show login modal automatically
        const loginOverlay = document.getElementById("loginModal");
        if (loginOverlay && !loginOverlay.classList.contains("open")) {
            loginOverlay.classList.add("open");
            loginOverlay.setAttribute("aria-hidden", "false");
            document.body.style.overflow = "hidden";
        }
        showToast("Sesión cerrada");
    }
    const signOutBtn = document.getElementById("adminSignOut");
    if (signOutBtn) signOutBtn.addEventListener("click", signOut);

    // Listen for signout requests from other parts of the app (e.g. settings dropdown)
    window.addEventListener("roblox:requestSignOut", signOut);

    // El profile-chip es solo visual — al hacer click no debe pasar nada.
    // El usuario cierra sesión desde el botón "Cerrar sesión" del panel admin
    // o desde el menú de ajustes (settings dropdown).
    const profileChip = document.querySelector(".profile-chip");
    if (profileChip) {
        profileChip.style.cursor = "default";
    }

    // ============== Admin: create user ==============
    const createForm = document.getElementById("adminCreateForm");
    let selectedIcon = "1.webp";
    if (createForm) {
        // Wire icon picker
        const iconPicker = document.getElementById("iconPicker");
        if (iconPicker) {
            iconPicker.querySelectorAll(".icon-option").forEach((opt) => {
                opt.addEventListener("click", () => {
                    iconPicker.querySelectorAll(".icon-option").forEach((o) => o.classList.remove("selected"));
                    opt.classList.add("selected");
                    selectedIcon = opt.dataset.icon;
                });
            });
        }

        createForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const username = document.getElementById("adminNewUsername").value.trim();
            const password = document.getElementById("adminNewPassword").value;
            // Forzar rol de usuario (los admins solo se crean desde Firebase Auth)
            const role = "user";
            const days = parseInt(document.getElementById("adminNewDuration").value, 10) || 30;
            const msg = document.getElementById("adminCreateMsg");
            const btn = document.getElementById("adminCreateBtn");

            if (!username || !password) {
                showMsg(msg, "Ingresa usuario y contraseña", "error");
                return;
            }
            if (username.length < 3) {
                showMsg(msg, "El usuario debe tener al menos 3 caracteres", "error");
                return;
            }
            // Solo letras, números, guion bajo, guion y punto.
            // (El . se sanitiza a _ automáticamente al guardar en RTDB)
            if (!/^[A-Za-z0-9_.\-]{3,32}$/.test(username)) {
                showMsg(msg, "Usuario inválido. Solo letras, números, guion bajo, guion y punto (3-32 caracteres).", "error");
                return;
            }
            if (password.length < 4) {
                showMsg(msg, "La contraseña debe tener al menos 4 caracteres", "error");
                return;
            }
            if (days < 1 || days > 365) {
                showMsg(msg, "La duración debe estar entre 1 y 365 días", "error");
                return;
            }

            setButtonLoading(btn, true, "Creando...");
            try {
                // Timeout de 8s para detectar problemas de RTDB
                const existing = await Promise.race([
                    findUser(username),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout-conexion")), 8000)),
                ]);
                if (existing) {
                    setButtonLoading(btn, false);
                    showMsg(msg, `El usuario "${username}" ya existe`, "error");
                    return;
                }
                await Promise.race([
                    createUser({ username, password, role, daysValid: days, avatar: selectedIcon }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout-conexion")), 8000)),
                ]);
                setButtonLoading(btn, false);
                showMsg(msg, `✓ Cuenta "${username}" creada. Válida por ${days} días. Credenciales: ${username} / ${password}`, "success");
                createForm.reset();
                document.getElementById("adminNewDuration").value = 30;
                // Reset icon picker al primero
                const iconPickerEl = document.getElementById("iconPicker");
                if (iconPickerEl) {
                    iconPickerEl.querySelectorAll(".icon-option").forEach((o, i) => {
                        o.classList.toggle("selected", i === 0);
                    });
                    selectedIcon = "1.webp";
                }
                await renderAdminUsers();
            } catch (e) {
                console.error(e);
                setButtonLoading(btn, false);
                if (e.message === "timeout-conexion") {
                    showMsg(msg, "No se puede conectar a la base de datos. Crea la Realtime Database en Firebase Console primero.", "error");
                } else {
                    showMsg(msg, "Error al crear la cuenta: " + (e.message || e), "error");
                }
            }
        });
    }

    function showMsg(el, text, type) {
        if (!el) return;
        el.textContent = text;
        el.className = "admin-form-msg " + type;
        el.hidden = false;
    }

    // ============== Admin: list users ==============
    async function renderAdminUsers() {
        const list = document.getElementById("adminUsersList");
        if (!list) return;
        list.innerHTML = '<p class="admin-empty">Cargando usuarios…</p>';
        let users;
        try {
            // Intentar leer la lista directamente con timeout
            // (no usamos .info/connected porque puede dar falsos negativos
            // si las reglas no permiten ese path específico)
            users = await Promise.race([
                listUsers(),
                new Promise((_, reject) => setTimeout(() => reject(new Error("timeout-leyendo-usuarios")), 8000)),
            ]);
        } catch (e) {
            console.error("RTDB list error:", e);
            const isTimeout = e.message === "timeout-leyendo-usuarios";
            const detail = isTimeout
                ? "La lectura tardó demasiado. Revisa las reglas de Firebase RTDB — deben permitir read en /users."
                : (e.message || String(e));
            list.innerHTML = `
                <div class="admin-error">
                    <strong>⚠️ No se pudo leer la lista de usuarios.</strong>
                    <p>Verifica las reglas de seguridad de Realtime Database en Firebase Console. Para que el sistema completo funcione (incluyendo límite de sesiones), las reglas deben permitir lectura y escritura en <code>users</code> y <code>sessions</code>:</p>
                    <pre style="background:#fff8e8;padding:8px;border-radius:4px;font-size:11px;margin:6px 0;overflow:auto;">{
  "rules": {
    "users":    { ".read": true, ".write": true },
    "sessions": { ".read": true, ".write": true }
  }
}</pre>
                    <p class="admin-error-detail">Detalle: ${escapeHtml(detail)}</p>
                </div>
            `;
            return;
        }
        if (users.length === 0) {
            list.innerHTML = '<p class="admin-empty">No hay usuarios registrados todavía. Crea uno arriba.</p>';
            return;
        }
        list.innerHTML = "";
        const now = Date.now();
        users.forEach((u) => {
            const expiresMs = u.expiresAt?.toMillis ? u.expiresAt.toMillis() : new Date(u.expiresAt).getTime();
            const isExpired = expiresMs < now;
            const daysLeft = Math.max(0, Math.ceil((expiresMs - now) / (24 * 60 * 60 * 1000)));
            const createdMs = u.createdAt?.toMillis ? u.createdAt.toMillis() : new Date(u.createdAt).getTime();
            const createdDate = new Date(createdMs);
            const avatarFile = u.avatar || "1.webp";
            const initial = (u.username || "?").charAt(0).toUpperCase();

            const hasDevice = Boolean(u.deviceId);

            const row = document.createElement("div");
            row.className = "admin-user-row";
            row.innerHTML = `
                <div class="admin-user-avatar">
                    <img src="recursos/iconos/${escapeHtml(avatarFile)}" alt="" onerror="this.remove();this.parentNode.innerHTML='<span class=&quot;admin-user-avatar-fallback&quot;>${escapeHtml(initial)}</span>'" />
                </div>
                <div class="admin-user-info">
                    <div class="admin-user-name">@${escapeHtml(u.username)}</div>
                    <div class="admin-user-meta">
                        <span class="admin-role-badge ${u.role === "admin" ? "admin" : "user"}">${escapeHtml(u.role || "user")}</span>
                        <span class="admin-status-badge ${isExpired ? "expired" : "active"}">${isExpired ? "Expirado" : `${daysLeft} día${daysLeft === 1 ? "" : "s"} restantes`}</span>
                        <span class="admin-device-badge ${hasDevice ? "bound" : "unbound"}">${hasDevice ? "📱 Dispositivo vinculado" : "📱 Sin vincular"}</span>
                        <span>Creado: ${createdDate.toLocaleDateString("es-CO")}</span>
                    </div>
                </div>
                <div class="admin-user-actions">
                    <button class="admin-reset-device-btn" type="button" data-username="${escapeHtml(u.username)}" title="Desvincular dispositivo actual para permitir que la cuenta inicie en un nuevo teléfono o PC">
                        🔄 Limpiar dispositivo
                    </button>
                    <button class="admin-delete-btn" type="button" data-username="${escapeHtml(u.username)}">Eliminar</button>
                </div>
            `;
            list.appendChild(row);
        });

        // Event listeners para Limpiar Dispositivo
        list.querySelectorAll(".admin-reset-device-btn").forEach((b) => {
            b.addEventListener("click", async () => {
                const username = b.dataset.username;
                if (!confirm(`¿Deseas limpiar y desvincular el dispositivo de la cuenta "@${username}"?\n\nAl hacerlo, el usuario podrá volver a iniciar sesión desde un nuevo teléfono o navegador.`)) return;
                try {
                    b.disabled = true;
                    b.textContent = "Limpiando…";
                    await resetUserDevice(username);
                    showToast(`Dispositivo liberado para @${username}`);
                    await renderAdminUsers();
                } catch (e) {
                    console.error("Error al limpiar dispositivo:", e);
                    showToast("Error al limpiar dispositivo");
                    b.disabled = false;
                    b.textContent = "🔄 Limpiar dispositivo";
                }
            });
        });

        // Event listeners para Eliminar Cuenta
        list.querySelectorAll(".admin-delete-btn").forEach((b) => {
            b.addEventListener("click", async () => {
                const username = b.dataset.username;
                if (!confirm(`¿Eliminar la cuenta "${username}"?`)) return;
                try {
                    await deleteUser(username);
                    showToast(`Cuenta "${username}" eliminada`);
                    await renderAdminUsers();
                } catch (e) {
                    console.error(e);
                    showToast("Error al eliminar");
                }
            });
        });
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    }

    const refreshBtn = document.getElementById("adminRefreshBtn");
    if (refreshBtn) refreshBtn.addEventListener("click", renderAdminUsers);

    // When the admin tab is activated, refresh the user list
    const adminTab = document.querySelector('.tab[data-tab="admin"]');
    if (adminTab) {
        adminTab.addEventListener("click", () => {
            setTimeout(renderAdminUsers, 50);
        });
    }

    // Initial auth state on page load
    updateAuthUI();
    // If no valid session, automatically show the login modal
    if (!isSessionValid(getSession())) {
        const loginOverlay = document.getElementById("loginModal");
        if (loginOverlay) {
            loginOverlay.classList.add("open");
            loginOverlay.setAttribute("aria-hidden", "false");
            document.body.style.overflow = "hidden";
        }
    }
})();

// ============== SETTINGS DROPDOWN (navbar gear) ==============
(function () {
    const btn = document.getElementById("settingsMenuBtn");
    const dropdown = document.getElementById("settingsDropdown");
    if (!btn || !dropdown) return;

    function open() {
        dropdown.hidden = false;
        btn.setAttribute("aria-expanded", "true");
    }
    function close() {
        dropdown.hidden = true;
        btn.setAttribute("aria-expanded", "false");
    }
    function isOpen() { return !dropdown.hidden; }

    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        isOpen() ? close() : open();
    });

    document.addEventListener("click", (e) => {
        if (!isOpen()) return;
        if (dropdown.contains(e.target) || btn.contains(e.target)) return;
        close();
    });

    document.addEventListener("pointerdown", (e) => {
        if (!isOpen()) return;
        if (dropdown.contains(e.target) || btn.contains(e.target)) return;
        close();
    }, true);

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && isOpen()) close();
    });

    dropdown.querySelectorAll(".settings-item").forEach((item) => {
        item.addEventListener("click", () => {
            const action = item.dataset.action;
            close();
            switch (action) {
                case "config":
                    showToast("Configuración (demo)");
                    break;
                case "quick-login":
                    showToast("Inicio de sesión rápido (demo)");
                    break;
                case "help":
                    showToast("Ayuda y seguridad (demo)");
                    break;
                case "switch":
                    // Open login modal so the user can log in with a different account
                    const loginOverlay = document.getElementById("loginModal");
                    if (loginOverlay) {
                        loginOverlay.classList.add("open");
                        loginOverlay.setAttribute("aria-hidden", "false");
                        document.body.style.overflow = "hidden";
                    }
                    break;
                case "signout":
                    // Dispatch a custom event so the Firebase IIFE handles the full signout flow
                    window.dispatchEvent(new CustomEvent("roblox:requestSignOut"));
                    break;
            }
        });
    });
})();

// ============== Tap feedback on cards ==============
document.querySelectorAll(".game-card, .item-card, .crear-tile").forEach((el) => {
    el.addEventListener("pointerdown", () => (el.style.opacity = "0.85"));
    el.addEventListener("pointerup", () => (el.style.opacity = ""));
    el.addEventListener("pointerleave", () => (el.style.opacity = ""));
});

// ============== Cuadrícula ondulada unificada (robux-grid-zone) ==============
// Limita la altura de la cuadrícula (.robux-grid-zone::before) para que
// termine a la mitad de la corona (no llegue al fondo del card). Se mide
// la posición de la imagen de la corona y se setea --grid-h en el wrapper.
(function () {
    const wrapper = document.querySelector(".robux-grid-zone");
    if (!wrapper) return;
    const hero = wrapper.querySelector("#robux-hero-section") || wrapper;

    function updateGridHeight() {
        const hRect = hero.getBoundingClientRect();
        const wTop = wrapper.getBoundingClientRect().top;
        const gridH = Math.max(120, Math.round(hRect.bottom - wTop));
        wrapper.style.setProperty("--grid-h", gridH + "px");
    }

    if (window.requestAnimationFrame) {
        requestAnimationFrame(updateGridHeight);
    } else {
        setTimeout(updateGridHeight, 50);
    }
    window.addEventListener("load", updateGridHeight);
    let rId = null;
    window.addEventListener("resize", () => {
        if (rId) cancelAnimationFrame(rId);
        rId = requestAnimationFrame(updateGridHeight);
    });
})();

// ============== BUY LOADING OVERLAY ==============
(function () {
    const overlay = document.getElementById("buyLoadingOverlay");
    if (!overlay) return;

    function showBuyLoading() {
        overlay.classList.add("active");
        overlay.setAttribute("aria-hidden", "false");
        setTimeout(function () {
            overlay.classList.remove("active");
            overlay.setAttribute("aria-hidden", "true");
        }, 1000);
    }

    // Detecta clicks en botones "Comprar" dentro de .purchase-pass-list
    document.addEventListener("click", function (e) {
        const btn = e.target.closest(".purchase-pass-list button");
        if (!btn) return;
        showBuyLoading();
    });
})();

// ============== FILTER DROPDOWNS (Dispositivo / Ubicación) ==============
document.addEventListener("DOMContentLoaded", function () {
    function setupDropdown(btnId, dropdownId, labelId, radioName, applyId, closeId) {
        var btn      = document.getElementById(btnId);
        var dropdown = document.getElementById(dropdownId);
        var label    = document.getElementById(labelId);
        var applyBtn = document.getElementById(applyId);
        var closeBtn = document.getElementById(closeId);
        if (!btn || !dropdown) return;

        function open() {
            dropdown.hidden = false;
            btn.setAttribute("aria-expanded", "true");
        }
        function close() {
            dropdown.hidden = true;
            btn.setAttribute("aria-expanded", "false");
        }

        btn.addEventListener("click", function (e) {
            e.stopPropagation();
            dropdown.hidden ? open() : close();
        });

        if (closeBtn) closeBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            close();
        });

        if (applyBtn) applyBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            var sel = dropdown.querySelector("input[name=" + radioName + "]:checked");
            if (sel && label) label.textContent = sel.value;
            close();
        });

        // Actualizar negrita al cambiar selección
        dropdown.querySelectorAll("input[name=" + radioName + "]").forEach(function (radio) {
            radio.addEventListener("change", function () {
                dropdown.querySelectorAll(".filter-option").forEach(function (opt) {
                    opt.classList.remove("filter-option-selected");
                });
                if (radio.checked) radio.closest(".filter-option").classList.add("filter-option-selected");
            });
        });

        // Cerrar al click fuera
        document.addEventListener("click", function (e) {
            if (!dropdown.hidden && !dropdown.contains(e.target) && e.target !== btn) {
                close();
            }
        });

        // Cerrar con Escape
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") close();
        });
    }

    setupDropdown("btnFilterDevice",   "deviceDropdown",   "filterDeviceLabel",   "device",   "deviceApplyBtn",   "deviceDropdownClose");
    setupDropdown("btnFilterLocation", "locationDropdown", "filterLocationLabel", "location", "locationApplyBtn", "locationDropdownClose");
});
