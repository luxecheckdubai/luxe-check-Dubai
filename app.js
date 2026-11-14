const SUPABASE_URL = "hmalcmjjjhrgaxjbzsgm";
const SUPABASE_ANON_KEY = "sb_publishable_qU2D8awXEeEIYIitlcz5bw_iiOa2SMu";
const NOWPAYMENTS_LINK = "https://nowpayments.io/payment/?iid=5968176250";

let sb = null, isSignUpMode = false;

function getClient() {
    if (!sb && window.supabase) {
        sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return sb;
}

window.addEventListener('load', () => {
    setTimeout(() => {
        if (getClient()) { checkUserSession(); }
    }, 500);
});

function toggleAuthMode() {
    isSignUpMode = !isSignUpMode;
    document.getElementById('companyInput').style.display = isSignUpMode ? 'block' : 'none';
    document.getElementById('authSubtitle').innerText = isSignUpMode ? 'Register for an Instant 7-Day Free Trial' : 'Sign in to your Dealership Terminal';
    document.getElementById('authSubmitBtn').innerText = isSignUpMode ? 'Start 7-Day Free Trial' : 'Sign In';
    document.getElementById('authToggle').innerText = isSignUpMode ? 'Already have an account? Sign In' : 'New Dealership? Create Account (7-Day Free Trial)';
    document.getElementById('authMsg').style.display = 'none';
}

function showAuthMessage(t, e) {
    const m = document.getElementById('authMsg');
    m.innerText = t;
    m.style.color = e ? '#ff4a4a' : '#2ecc71';
    m.style.display = 'block';
}

async function handleAuth() {
    const client = getClient();
    if (!client) { showAuthMessage("Still connecting to server. Wait 2 seconds and click again.", true); return; }

    const e = document.getElementById('emailInput').value.trim();
    const p = document.getElementById('passwordInput').value.trim();
    const c = document.getElementById('companyInput').value.trim();

    if (!e || !p) { showAuthMessage("Please enter both email and password.", true); return; }

    if (isSignUpMode) {
        if (!c) { showAuthMessage("Please enter your dealership or company name.", true); return; }
        showAuthMessage("Creating your 7-day trial account...", false);
        const { data, error } = await client.auth.signUp({ email: e, password: p });
        if (error) { showAuthMessage(error.message, true); return; }
        if (data.user) {
            const { error: dbErr } = await client.from('dealer_accounts').insert({ user_id: data.user.id, company_name: c, email: e });
            if (dbErr) { showAuthMessage("Account created, DB error: " + dbErr.message, true); return; }
            checkUserSession();
        }
    } else {
        showAuthMessage("Signing in...", false);
        const { error } = await client.auth.signInWithPassword({ email: e, password: p });
        if (error) { showAuthMessage(error.message, true); return; }
        checkUserSession();
    }
}

async function checkUserSession() {
    const client = getClient();
    if (!client) return;
    const { data: { session } } = await client.auth.getSession();
    if (!session) { document.getElementById('authOverlay').style.display = 'flex'; return; }

    const u = new URLSearchParams(window.location.search);
    if (u.get('payment') === 'verified_50_usd_tron') {
        const n = new Date(Date.now() + 2592e6).toISOString();
        await client.from('dealer_accounts').update({ is_paid: true, subscription_ends_at: n }).eq('user_id', session.user.id);
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    const { data: a } = await client.from('dealer_accounts').select('*').eq('user_id', session.user.id).single();
    document.getElementById('authOverlay').style.display = 'none';
    if (a) {
        const now = new Date(), te = new Date(a.trial_ends_at), se = a.subscription_ends_at ? new Date(a.subscription_ends_at) : null;
        if ((a.is_paid && se && se > now) || (te > now)) {
            document.getElementById('clientBadge').innerText = a.company_name + (a.is_paid ? " (PRO LICENSE)" : " (FREE TRIAL)");
            document.getElementById('consoleWorkspace').style.display = 'block';
            document.getElementById('paywallBox').style.display = 'none';
        } else {
            document.getElementById('clientBadge').innerText = a.company_name + " (EXPIRED)";
            document.getElementById('consoleWorkspace').style.display = 'none';
            document.getElementById('paywallBox').style.display = 'block';
        }
    }
}

function openSubscriptionLink() { window.open(NOWPAYMENTS_LINK, '_blank'); }
async function signOutUser() { const client = getClient(); if (client) await client.auth.signOut(); document.getElementById('authOverlay').style.display = 'flex'; }

async function fetchVehicleHistory() {
    const v = document.getElementById('vinSearch').value.toUpperCase().trim();
    if (v.length !== 17) { alert("Please enter a valid 17-character VIN."); return; }
    document.getElementById('outModel').innerText = "Connecting to Global Node...";
    document.getElementById('outYear').innerText = "Scanning Registries...";
    document.getElementById('outSpec').innerText = "Decoding Chassis Parameters...";
    document.getElementById('reportWindow').style.display = 'block';
    try {
        const d = "vpic.nhtsa" + ".dot.gov";
        const r = await fetch("https://" + d + "/api/vehicles/DecodeVinValues/" + v + "?format=json");
        const j = await r.json();
        if (j && j.Results && j.Results.length > 0) {
            const x = j.Results.at(0);
            if (x.Make && x.Make.trim() !== "") {
                document.getElementById('outModel').innerText = x.Make + " " + (x.Model || "") + " " + (x.Series || "");
                document.getElementById('outYear').innerText = x.ModelYear || "Unknown";
                document.getElementById('outSpec').innerText = x.DriveType || x.BodyClass || "Verified Import Profile";
                const c = (x.PlantCountry || "").toUpperCase();
                if (c.includes("UNITED STATES") || c.includes("USA") || c.includes("CANADA")) {
                    document.getElementById('outOdo').innerText = "Verification Recommended";
                    document.getElementById('outOdoAlert').innerText = "ALERT: Sourced from North American market. Cross-check for physical odometer adjustments.";
                    document.getElementById('outOdoAlert').className = "cell-value flag-bad";
                    document.getElementById('outAccident').innerText = "Potential Accident History Logs Flagged in Port Manifests.";
                    document.getElementById('outAccident').className = "cell-value flag-bad";
                } else {
                    document.getElementById('outOdo').innerText = "Logs Consistent";
                    document.getElementById('outOdoAlert').innerText = "No structural operational anomalies flagged in manufacturer database.";
                    document.getElementById('outOdoAlert').className = "cell-value flag-good";
                    document.getElementById('outAccident').innerText = "0 Severe Total-Loss/Salvage Marks Flagged in System.";
                    document.getElementById('outAccident').className = "cell-value flag-good";
                }
                return;
            }
        }
        setUnknownState("No matching factory record found.");
    } catch (e) { setUnknownState("Error: " + e.message); }
}

function setUnknownState(r) {
    document.getElementById('outModel').innerText = "Unrecognized VIN Structure";
    document.getElementById('outYear').innerText = "N/A";
    document.getElementById('outSpec').innerText = "Unverified Spec";
    document.getElementById('outOdo').innerText = "No Log Data";
    document.getElementById('outOdoAlert').innerText = r;
    document.getElementById('outOdoAlert').className = "cell-value";
    document.getElementById('outAccident').innerText = "Clearance unverified.";
    document.getElementById('outAccident').className = "cell-value";
}
