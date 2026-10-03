import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

OUT = os.path.dirname(os.path.abspath(__file__)).replace("\\", "/") + "/"

os.makedirs(OUT, exist_ok=True)

GOLD = "#BF9000"
DARK = "#434343"
C = {
    "actor": "#FFF2CC", "client": "#DDEBF7", "gw": "#FCE4D6", "svc": "#E2EFDA",
    "db": "#EDEDED", "ext": "#E4DFEC", "legacy": "#F8CBAD", "zone": "#FAFAFA",
}
plt.rcParams["font.family"] = "Arial"


def box(ax, x, y, w, h, text, fc, fs=9, bold=False, ec=DARK, ls="-", round_=0.02):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle=f"round,pad=0,rounding_size={round_}",
                                fc=fc, ec=ec, lw=1.1, ls=ls))
    ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", fontsize=fs,
            fontweight="bold" if bold else "normal", wrap=True, color="#222222")


def zone(ax, x, y, w, h, label):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0,rounding_size=0.01",
                                fc=C["zone"], ec="#9E9E9E", lw=1, ls="--"))
    ax.text(x + 0.008, y + h - 0.012, label, ha="left", va="top", fontsize=8.5,
            color="#616161", fontweight="bold")


def arrow(ax, p1, p2, label="", both=False, fs=7.5, off=(0, 0), color="#333333", ls="-", rad=0.0):
    ax.add_patch(FancyArrowPatch(p1, p2, arrowstyle="<|-|>" if both else "-|>",
                                 mutation_scale=11, lw=1.0, color=color, ls=ls,
                                 connectionstyle=f"arc3,rad={rad}"))
    if label:
        mx, my = (p1[0] + p2[0]) / 2 + off[0], (p1[1] + p2[1]) / 2 + off[1]
        ax.text(mx, my, label, ha="center", va="center", fontsize=fs, color="#333333",
                bbox=dict(fc="white", ec="none", pad=0.6))


def canvas(w, h):
    fig = plt.figure(figsize=(w, h), dpi=200)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.axis("off")
    return fig, ax


def save(fig, name):
    fig.savefig(OUT + name, dpi=200, facecolor="white")
    plt.close(fig)


# ---------------- AS-IS ----------------
fig, ax = canvas(11, 6.2)
ax.text(0.5, 0.97, "AS-IS: PWD job search, employer checking and accommodation follow-up (manual, fragmented)",
        ha="center", va="top", fontsize=11, fontweight="bold", color=GOLD)
box(ax, 0.02, 0.56, 0.15, 0.13, "PWD Job Seeker", C["actor"], 10, True)
box(ax, 0.83, 0.72, 0.15, 0.13, "Employer /\nHR Officer", C["actor"], 10, True)
box(ax, 0.83, 0.36, 0.15, 0.13, "PESO / PDAO\nOfficer", C["actor"], 10, True)
zone(ax, 0.29, 0.52, 0.25, 0.40, "Separate job boards (no shared data)")
box(ax, 0.31, 0.74, 0.21, 0.12, "General job boards\n(PhilJobNet, JobStreet)\nfree-text postings", C["ext"], 8.5)
box(ax, 0.31, 0.55, 0.21, 0.12, "PWD job boards\n(PWD-E, Access Careers)\nskills / disability / shift", C["ext"], 8.5)
box(ax, 0.31, 0.34, 0.21, 0.11, "Social media groups,\nemail and phone calls", C["ext"], 8.5)
box(ax, 0.31, 0.16, 0.21, 0.11, "Online maps\n(commute and entrance\nchecked separately)", C["ext"], 8.5)
box(ax, 0.60, 0.36, 0.17, 0.12, "DTI BNRS / SEC\nregistry websites\n(checked by hand)", C["legacy"], 8.5)
box(ax, 0.60, 0.16, 0.17, 0.12, "Paper forms and\nspreadsheets\n(PESO PWD registry)", C["db"], 8.5)
box(ax, 0.29, 0.02, 0.48, 0.09, "No system records whether advertised accommodations were delivered after hire\n(experience shared only by word of mouth)", "#FDECEA", 8.5, ec="#C0392B", ls="--")
arrow(ax, (0.17, 0.66), (0.29, 0.76), "1. searches each board,\nre-enters profile", off=(-0.02, 0.04))
arrow(ax, (0.17, 0.61), (0.31, 0.41), "2. asks about\naccommodations", off=(-0.01, 0.0))
arrow(ax, (0.17, 0.58), (0.31, 0.22), "3. looks up commute", off=(-0.03, -0.03))
arrow(ax, (0.12, 0.56), (0.29, 0.07), "4. discovers mismatch at\ninterview or after hire", off=(-0.06, -0.06), color="#C0392B", ls="--")
arrow(ax, (0.83, 0.79), (0.54, 0.80), "posts free-text job\n(accommodations buried)", off=(0.0, 0.035))
arrow(ax, (0.83, 0.74), (0.52, 0.42), "answers questions\nby phone / chat", off=(0.06, 0.03))
arrow(ax, (0.83, 0.43), (0.77, 0.42), "")
ax.text(0.80, 0.505, "verifies employer\nmanually", ha="center", fontsize=7.5)
arrow(ax, (0.83, 0.38), (0.77, 0.24), "encodes\nregistrants", off=(0.035, -0.02))
save(fig, "fig1_as_is.png")

# ---------------- TO-BE architecture ----------------
fig, ax = canvas(11, 7.2)
ax.text(0.5, 0.975, "OpenDoor final architecture (API gateway + services)", ha="center", va="top",
        fontsize=12, fontweight="bold", color=GOLD)
box(ax, 0.02, 0.78, 0.14, 0.10, "PWD Job Seeker\nEmployer / HR\nAdministrator", C["actor"], 8.5, True)
zone(ax, 0.20, 0.74, 0.20, 0.18, "Vercel (CDN)")
box(ax, 0.22, 0.76, 0.16, 0.11, "React SPA\n(Vite, React Router,\nAxios, AuthContext)", C["client"], 8.5, True)
arrow(ax, (0.16, 0.83), (0.22, 0.83), "HTTPS")
zone(ax, 0.20, 0.04, 0.58, 0.64, "Railway project (cloud)  —  only the gateway is public")
box(ax, 0.39, 0.52, 0.37, 0.10, "API Gateway  (Node.js 22 + Express)\nrouting · CORS · rate limit · X-Request-ID · timeouts · error envelope", C["gw"], 8.3, True)
arrow(ax, (0.30, 0.76), (0.44, 0.62), "HTTPS  REST/JSON\nBearer token", off=(-0.04, 0.0))
box(ax, 0.215, 0.27, 0.105, 0.15, "Business\nRegistry\nService\n(legacy SOAP)\nPHP SoapServer", C["legacy"], 7.8, True)
box(ax, 0.40, 0.25, 0.17, 0.19, "Core Service\nLaravel 13 + Sanctum\nAuth · Profiles · Postings\nMatching · Applications\nFeedback · Trust score\nModeration · Master data", C["svc"], 7.8, True)
box(ax, 0.63, 0.28, 0.13, 0.14, "Accessibility\nInsights Service\n(Node.js + Express)\nmashup", C["svc"], 7.8, True)
box(ax, 0.215, 0.07, 0.105, 0.10, "SQLite\nregistry.db", C["db"], 8)
box(ax, 0.40, 0.07, 0.17, 0.10, "MySQL 8\nopendoor_core", C["db"], 8.5)
box(ax, 0.63, 0.07, 0.13, 0.10, "MySQL 8\ninsights_cache", C["db"], 8.5)
arrow(ax, (0.485, 0.52), (0.485, 0.44), "/api/*", off=(0.025, 0))
arrow(ax, (0.695, 0.52), (0.695, 0.42), "/api/insights/*", off=(0.0, 0.0))
arrow(ax, (0.40, 0.345), (0.32, 0.345), "SOAP 1.1\nXML", off=(0.0, 0.04))
arrow(ax, (0.63, 0.35), (0.57, 0.35), "REST\nservice key", off=(0.0, 0.045))
arrow(ax, (0.2675, 0.27), (0.2675, 0.17), "PDO", off=(0.02, 0))
arrow(ax, (0.485, 0.25), (0.485, 0.17), "Eloquent", off=(0.035, 0))
arrow(ax, (0.695, 0.28), (0.695, 0.17), "cache", off=(0.025, 0))
zone(ax, 0.82, 0.20, 0.17, 0.52, "External REST APIs")
box(ax, 0.84, 0.56, 0.13, 0.09, "OSM Nominatim\n(geocoding)", C["ext"], 8.5)
box(ax, 0.84, 0.42, 0.13, 0.09, "Overpass API\n(wheelchair-tagged\nplaces)", C["ext"], 8.5)
box(ax, 0.84, 0.28, 0.13, 0.09, "PSGC API\n(PH regions,\nprovinces, cities)", C["ext"], 8.5)
arrow(ax, (0.76, 0.39), (0.84, 0.60))
arrow(ax, (0.76, 0.36), (0.84, 0.465))
arrow(ax, (0.76, 0.33), (0.84, 0.325))
ax.text(0.80, 0.25, "HTTPS\nREST/JSON", ha="center", fontsize=7.5)
lx = 0.02
for i, (k, lab) in enumerate([("client", "Client"), ("gw", "Gateway"), ("svc", "Service"),
                              ("legacy", "Legacy / SOAP"), ("db", "Data store"), ("ext", "External API")]):
    box(ax, lx, 0.60 - i * 0.075, 0.035, 0.045, "", C[k], 7, round_=0.005)
    ax.text(lx + 0.045, 0.6225 - i * 0.075, lab, va="center", fontsize=8)
save(fig, "fig2_architecture.png")

# ---------------- sequence helper ----------------
def sequence(name, title, parts, msgs, w=11, h=7.0):
    fig, ax = canvas(w, h)
    ax.text(0.5, 0.975, title, ha="center", va="top", fontsize=11.5, fontweight="bold", color=GOLD)
    n = len(parts)
    xs = [0.07 + i * (0.86 / (n - 1)) for i in range(n)]
    top, bottom = 0.90, 0.03
    for x, (lab, kind) in zip(xs, parts):
        box(ax, x - 0.065, top - 0.06, 0.13, 0.06, lab, C[kind], 8, True)
        ax.plot([x, x], [top - 0.06, bottom], color="#9E9E9E", lw=0.8, ls="--")
    step = (top - 0.10 - bottom) / (len(msgs) + 0.5)
    y = top - 0.10
    for i, (a, b, text, kind) in enumerate(msgs, 1):
        if a == b:
            x = xs[a]
            ax.text(x + 0.008, y, f"{i}. {text}", fontsize=7.4, va="center", ha="left",
                    bbox=dict(fc="#FFFDE7", ec="#BDBDBD", lw=0.6, pad=2))
        else:
            ls = "--" if kind == "r" else "-"
            col = "#C0392B" if kind == "e" else "#333333"
            ax.add_patch(FancyArrowPatch((xs[a], y), (xs[b], y), arrowstyle="-|>", mutation_scale=10,
                                         lw=0.9, color=col, ls=ls))
            ax.text((xs[a] + xs[b]) / 2, y + 0.011, f"{i}. {text}", fontsize=7.4, ha="center", va="bottom",
                    color=col)
        y -= step
    save(fig, name)


sequence("fig3_sequence_match_apply.png",
         "Core transaction: candidate opens a matched job, sees its Accessibility Snapshot, and applies",
         [("Candidate\n(React SPA)", "client"), ("API Gateway", "gw"), ("Core Service\n(Laravel)", "svc"),
          ("Insights Service", "svc"), ("Nominatim /\nOverpass", "ext")],
         [
             (0, 1, "GET /api/job-postings/42?match=1  (Bearer token)", "c"),
             (1, 2, "forward + X-Request-ID", "c"),
             (2, 2, "Sanctum auth, Policy, count needs met", "c"),
             (2, 1, "200 posting + match {met:4,total:5,missing} + trust_score", "r"),
             (1, 0, "200 JSON", "r"),
             (0, 1, "GET /api/insights/job-postings/42", "c"),
             (1, 3, "forward + X-Request-ID", "c"),
             (3, 2, "GET /internal/job-postings/42/summary  (X-Service-Key)", "c"),
             (2, 3, "200 address, psgc_code, accommodations, trust_score", "r"),
             (3, 4, "geocode address (cache miss) ; Overpass: wheelchair=yes within 500 m", "c"),
             (4, 3, "200 lat/lon ; OSM elements", "r"),
             (3, 3, "normalize + merge -> snapshot (cache 24 h)", "c"),
             (3, 1, "200 snapshot {sources: ok|degraded}", "r"),
             (1, 0, "200 JSON (rendered on job details)", "r"),
             (0, 1, "POST /api/job-postings/42/applications {cover_note, interview_request}", "c"),
             (1, 2, "forward", "c"),
             (2, 2, "validate, unique check, status=pending, notify employer", "c"),
             (2, 1, "201 application  |  409 ALREADY_APPLIED  |  422 POSTING_CLOSED", "r"),
             (1, 0, "201 / 4xx error envelope", "r"),
         ], h=7.6)

sequence("fig4_sequence_verify.png",
         "Integration flow: administrator verifies an employer against the legacy SOAP business registry",
         [("Admin\n(React SPA)", "client"), ("API Gateway", "gw"), ("Core Service\n(Laravel)", "svc"),
          ("Business Registry\n(SOAP)", "legacy"), ("MySQL\nopendoor_core", "db")],
         [
             (0, 1, "PATCH /api/admin/employers/7/verify {action:'check'}", "c"),
             (1, 2, "forward + X-Request-ID", "c"),
             (2, 4, "load employer (business_reg_no, company_name)", "c"),
             (2, 3, "SOAP VerifyBusinessRegistration (XML + UsernameToken)", "c"),
             (3, 3, "lookup registry.db, compare names", "c"),
             (3, 2, "XML response: status=ACTIVE, registeredName, matchScore", "r"),
             (2, 2, "map XML -> JSON, store registry_check", "c"),
             (2, 1, "200 {registry:{status:'ACTIVE', name_match:0.96}}", "r"),
             (1, 0, "200 JSON (admin reviews)", "r"),
             (0, 1, "PATCH /api/admin/employers/7/verify {action:'approve'}", "c"),
             (1, 2, "forward", "c"),
             (2, 4, "set verified_at, notify employer", "c"),
             (2, 0, "200 Verified badge active   |   SOAP Fault / timeout -> 502 REGISTRY_UNAVAILABLE", "e"),
         ], h=6.2)

# ---------------- deployment ----------------
fig, ax = canvas(11, 6.4)
ax.text(0.5, 0.975, "Deployment architecture and network boundaries", ha="center", va="top",
        fontsize=12, fontweight="bold", color=GOLD)
box(ax, 0.02, 0.62, 0.13, 0.13, "User browser\n(desktop / phone,\nscreen reader)", C["actor"], 8.5, True)
zone(ax, 0.20, 0.60, 0.17, 0.25, "Vercel  (public)")
box(ax, 0.215, 0.63, 0.14, 0.14, "React SPA build\nopendoor.vercel.app\nVITE_API_URL", C["client"], 8.5)
zone(ax, 0.42, 0.05, 0.40, 0.85, "Railway project  ·  production environment")
zone(ax, 0.44, 0.66, 0.36, 0.17, "Public network (HTTPS, *.up.railway.app)")
box(ax, 0.52, 0.68, 0.20, 0.10, "api-gateway\n:8080 (Express)", C["gw"], 8.5, True)
zone(ax, 0.44, 0.08, 0.36, 0.55, "Private network (*.railway.internal, not reachable from internet)")
box(ax, 0.46, 0.40, 0.15, 0.12, "core-api\n:8001 Laravel 13\n(Docker, php-fpm+nginx)", C["svc"], 8)
box(ax, 0.63, 0.40, 0.15, 0.12, "insights-service\n:8002 Node 22", C["svc"], 8)
box(ax, 0.46, 0.12, 0.15, 0.12, "business-registry-soap\n:8003 PHP 8.3", C["legacy"], 8)
box(ax, 0.63, 0.12, 0.15, 0.12, "MySQL 8 (managed)\nopendoor_core\ninsights_cache", C["db"], 8)
zone(ax, 0.86, 0.30, 0.13, 0.40, "Internet")
box(ax, 0.87, 0.55, 0.11, 0.08, "Nominatim", C["ext"], 8)
box(ax, 0.87, 0.45, 0.11, 0.08, "Overpass", C["ext"], 8)
box(ax, 0.87, 0.35, 0.11, 0.08, "PSGC API", C["ext"], 8)
zone(ax, 0.02, 0.08, 0.35, 0.40, "GitHub")
box(ax, 0.04, 0.27, 0.14, 0.12, "Monorepo\nmain / develop /\nfeature/*", C["db"], 8)
box(ax, 0.21, 0.27, 0.14, 0.12, "GitHub Actions\nlint · test · build\nNewman smoke", C["gw"], 8)
arrow(ax, (0.18, 0.33), (0.21, 0.33))
arrow(ax, (0.28, 0.39), (0.28, 0.60), "deploy hook\n(main)", off=(0.035, 0))
arrow(ax, (0.35, 0.30), (0.46, 0.46), "Railway GitHub\nauto-deploy", off=(-0.01, -0.03))
arrow(ax, (0.15, 0.70), (0.215, 0.70), "HTTPS")
arrow(ax, (0.085, 0.75), (0.52, 0.75), "HTTPS /api/*", off=(0.0, 0.13), rad=-0.35)
arrow(ax, (0.58, 0.68), (0.535, 0.52))
arrow(ax, (0.66, 0.68), (0.705, 0.52))
arrow(ax, (0.535, 0.40), (0.535, 0.24), "SOAP", off=(0.025, 0))
arrow(ax, (0.63, 0.45), (0.61, 0.45))
arrow(ax, (0.58, 0.40), (0.67, 0.24), "SQL", off=(0.015, 0.01))
arrow(ax, (0.705, 0.40), (0.705, 0.24))
arrow(ax, (0.78, 0.47), (0.87, 0.58))
arrow(ax, (0.78, 0.46), (0.87, 0.49))
arrow(ax, (0.78, 0.45), (0.87, 0.39))
save(fig, "fig5_deployment.png")
print("done")
