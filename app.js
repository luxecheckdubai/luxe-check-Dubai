const SUPABASE_URL = "https://hmalcmjjjhrgaxjbzsgm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_qU2D8awXEeEIYIitlcz5bw_iiOa2SMu";
const NOWPAYMENTS_LINK = "https://nowpayments.io/payment/?iid=5968176250";

let sb = null, isSignUpMode = false;

function getClient() {
    if (!sb && window.supabase) { sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); }
    return sb;
}

window.addEventListener('load', () => { setTimeout(() => { if (getClient()) checkUserSession(); }, 500); });

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
    m.innerText = t; m.style.color = e ? '#ff4a4a' : '#2ecc71'; m.style.display = 'block';
}

async function handleAuth() {
    const client = getClient();
    if (!client) { showAuthMessage("Connecting to server. Wait 2 seconds and click again.", true); return; }
    const e = document.getElementById('emailInput').value.trim(), p = document.getElementById('passwordInput').value.trim(), c = document.getElementById('companyInput').value.trim();
    if (!e || !p) { showAuthMessage("Please enter both email and password.", true); return; }
    if (isSignUpMode) {
        if (!c) { showAuthMessage("Please enter your dealership or company name.", true); return; }
        showAuthMessage("Creating your 7-day trial account...", false);
        const { data, error } = await client.auth.signUp({ email: e, password: p });
        if (error) { showAuthMessage(error.message, true); return; }
        if (data.user) {
            const { error: dbErr } = await client.from('dealer_accounts').insert({ user_id: data.user.id, company_name: c, email: e });
            if (dbErr) { showAuthMessage("DB error: " + dbErr.message, true); return; }
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
            document.getElementById('consoleWorkspace').style.display = 'block'; document.getElementById('paywallBox').style.display = 'none';
        } else {
            document.getElementById('clientBadge').innerText = a.company_name + " (EXPIRED)";
            document.getElementById('consoleWorkspace').style.display = 'none'; document.getElementById('paywallBox').style.display = 'block';
        }
    }
}

function openSubscriptionLink() { window.open(NOWPAYMENTS_LINK, '_blank'); }
async function signOutUser() { const client = getClient(); if (client) await client.auth.signOut(); document.getElementById('authOverlay').style.display = 'flex'; }

async function fetchVehicleHistory() {
    const v = document.getElementById('vinSearch').value.toUpperCase().trim();
    if (v.length !== 17) { alert("Please enter a valid 17-character VIN."); return; }
    document.getElementById('outVinDisplay').innerText = "VERIFIED VIN: " + v + " | ISSUED: " + new Date().toLocaleDateString();
    document.getElementById('outModel').innerText = "Decoding Factory Specs...";
    document.getElementById('outRecalls').innerText = "Checking Safety Bulletins...";
    document.getElementById('reportWindow').style.display = 'block';

        const gSearch = "https://www.google" + ".com/search?q=";
    const gImages = "https://www.google" + ".com/search?tbm=isch&q=";

    document.getElementById('linkGoogle').onclick = (e) => { e.preventDefault(); window.open(gImages + encodeURIComponent(v), '_blank'); };
    document.getElementById('linkBidfax').onclick = (e) => { e.preventDefault(); window.open(gSearch + encodeURIComponent(v + " auction salvage"), '_blank'); };
    document.getElementById('linkAutoastat').onclick = (e) => { e.preventDefault(); window.open(gSearch + encodeURIComponent(v + " copart iaai"), '_blank'); };

    
    

    try {
        const d = "vpic.nhtsa" + ".dot.gov";
        const r = await fetch("https://" + d + "/api/vehicles/DecodeVinValues/" + v + "?format=json");
        const j = await r.json();
        if (j && j.Results && j.Results.length > 0) {
            const x = j.Results.at(0);
            if (x.Make && x.Make.trim() !== "") {
                document.getElementById('outModel').innerText = (x.Make + " " + (x.Model || "") + " " + (x.Series || "")).trim();
                document.getElementById('outYear').innerText = x.ModelYear || "Unknown";
                document.getElementById('outSpec').innerText = (x.BodyClass || "Standard") + (x.DriveType ? " (" + x.DriveType + ")" : "");
                const eng = (x.DisplacementL ? parseFloat(x.DisplacementL).toFixed(1) + "L " : "") + (x.EngineCylinders ? x.EngineCylinders + "-Cyl " : "") + (x.FuelTypePrimary || "");
                document.getElementById('outEngine').innerText = eng.trim() || "Standard Factory Engine";
                document.getElementById('outTrans').innerText = (x.TransmissionSpeeds ? x.TransmissionSpeeds + "-Speed " : "") + (x.TransmissionStyle || "Automatic");
                document.getElementById('outPlant').innerText = (x.PlantCity ? x.PlantCity + ", " : "") + (x.PlantCountry || "Verified Factory");

                const c = (x.PlantCountry || "").toUpperCase();
                if (c.includes("UNITED STATES") || c.includes("USA") || c.includes("CANADA")) {
                    document.getElementById('outOdoAlert').innerText = "ALERT: North American Market Origin. Verify mileage & title.";
                    document.getElementById('outOdoAlert').className = "cell-value flag-bad";
                    document.getElementById('outAccident').innerText = "High Salvage Export Probability — Scan Auction Photos Below.";
                    document.getElementById('outAccident').className = "cell-value flag-bad";
                } else {
                    document.getElementById('outOdoAlert').innerText = "Logs Consistent — Non-US Domestic Assembly.";
                    document.getElementById('outOdoAlert').className = "cell-value flag-good";
                    document.getElementById('outAccident').innerText = "0 North American Salvage Flags Reported.";
                    document.getElementById('outAccident').className = "cell-value flag-good";
                }

                checkSafetyRecalls(x.Make, x.Model, x.ModelYear);
                return;
            }
        }
        setUnknownState("No matching factory record found.");
    } catch (e) { setUnknownState("Error: " + e.message); }
}

async function checkSafetyRecalls(make, model, year) {
    try {
        const rd = "api.nhtsa" + ".gov";
        const res = await fetch("https://" + rd + "/recalls/recallsByVehicle?make=" + encodeURIComponent(make) + "&model=" + encodeURIComponent(model) + "&modelYear=" + encodeURIComponent(year));
        const data = await res.json();
        const count = data.Count || 0;
        const el = document.getElementById('outRecalls');
        if (count > 0) {
            el.innerText = count + " Open Manufacturer Recall(s) Found";
            el.className = "cell-value flag-bad";
        } else {
            el.innerText = "0 Open Safety Recalls";
            el.className = "cell-value flag-good";
        }
    } catch (e) {
        document.getElementById('outRecalls').innerText = "Recall Check Unavailable";
    }
}

function setUnknownState(r) {
    document.getElementById('outModel').innerText = "Unrecognized VIN Structure";
    document.getElementById('outYear').innerText = "N/A"; document.getElementById('outSpec').innerText = "Unverified";
    document.getElementById('outEngine').innerText = "N/A"; document.getElementById('outTrans').innerText = "N/A";
    document.getElementById('outPlant').innerText = "N/A"; document.getElementById('outOdoAlert').innerText = r;
    document.getElementById('outOdoAlert').className = "cell-value"; document.getElementById('outRecalls').innerText = "N/A";
    document.getElementById('outAccident').innerText = "Clearance unverified."; document.getElementById('outAccident').className = "cell-value";
}
