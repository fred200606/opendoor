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


def save(fig, name, tight=False):
    fig.savefig(OUT + name, dpi=200, facecolor="white")
    plt.close(fig)
    if tight:  # cut the empty margin below the content (keeps the full width)
        from PIL import Image, ImageOps
        im = Image.open(OUT + name).convert("RGB")
        bottom = ImageOps.invert(im.convert("L")).getbbox()[3]
        im.crop((0, 0, im.width, min(im.height, bottom + 40))).save(OUT + name)


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
box(ax, 0.84, 0.08, 0.13, 0.10, "Email provider\n(SMTP, chosen\nat deployment)", C["ext"], 8)
arrow(ax, (0.57, 0.26), (0.84, 0.15), "notices,\nreset links", off=(0.085, 0.005))
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
box(ax, 0.46, 0.40, 0.15, 0.12, "core-api :8001\nLaravel 13, FrankenPHP\n+ core-scheduler", C["svc"], 8)
box(ax, 0.63, 0.40, 0.15, 0.12, "insights-service\n:8002 Node 22", C["svc"], 8)
box(ax, 0.46, 0.12, 0.15, 0.12, "business-registry-soap\n:8003 PHP 8.4\n(FrankenPHP)", C["legacy"], 8)
box(ax, 0.63, 0.12, 0.15, 0.12, "MySQL 8 (managed)\nopendoor_core\ninsights_cache", C["db"], 8)
zone(ax, 0.86, 0.20, 0.13, 0.50, "Internet")
box(ax, 0.87, 0.55, 0.11, 0.08, "Nominatim", C["ext"], 8)
box(ax, 0.87, 0.45, 0.11, 0.08, "Overpass", C["ext"], 8)
box(ax, 0.87, 0.35, 0.11, 0.08, "PSGC API", C["ext"], 8)
box(ax, 0.87, 0.23, 0.11, 0.08, "Email (SMTP)", C["ext"], 8)
zone(ax, 0.02, 0.08, 0.35, 0.40, "GitHub")
box(ax, 0.04, 0.27, 0.14, 0.12, "Monorepo\nmain / develop", C["db"], 8)
box(ax, 0.21, 0.27, 0.14, 0.12, "GitHub Actions\nlint · test · build\nNewman · axe", C["gw"], 8)
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
arrow(ax, (0.61, 0.40), (0.87, 0.27))
save(fig, "fig5_deployment.png")

# ---------------- ERD: Core Service (opendoor_core) ----------------
# Tables and keys as in services/core-api/database/migrations. Pivot tables have a lighter title bar.
fig, ax = canvas(8.5, 10)
ax.text(0.5, 0.985, "Core Service data model (MySQL opendoor_core)", ha="center", va="top",
        fontsize=12, fontweight="bold", color=GOLD)
COLS, BW, LINE, HEAD = [0.02, 0.27, 0.52, 0.77], 0.21, 0.0128, 0.021
T = {}


def table(name, col, top, fields, pivot=False):
    x = COLS[col]
    h = HEAD + LINE * len(fields) + 0.008
    ax.add_patch(FancyBboxPatch((x, top - h), BW, h, boxstyle="round,pad=0,rounding_size=0.004",
                                fc="#F7F7F7", ec=DARK, lw=1.0))
    ax.add_patch(FancyBboxPatch((x, top - HEAD), BW, HEAD, boxstyle="round,pad=0,rounding_size=0.004",
                                fc="#8C8C8C" if pivot else DARK, ec=DARK, lw=1.0))
    ax.text(x + 0.008, top - HEAD / 2, name, va="center", fontsize=8, fontweight="bold", color="white")
    for i, f in enumerate(fields):
        ax.text(x + 0.008, top - HEAD - 0.004 - LINE * (i + 0.5), f, va="center", fontsize=7, color="#222222")
    T[name] = (x, top - h, BW, h)  # left, bottom, width, height


def side(name, where, t=0.5):
    """Point on a table's edge: where = top/bottom/left/right, t = position along that edge (0..1)."""
    x, y, w, h = T[name]
    return {"top": (x + w * t, y + h), "bottom": (x + w * t, y), "left": (x, y + h * (1 - t)),
            "right": (x + w, y + h * (1 - t))}[where]


def rel(points, a, b):
    """Relationship line through `points`; cardinality `a` at the first end, `b` at the last."""
    xs, ys = zip(*points)
    ax.plot(xs, ys, color="#333333", lw=0.9, zorder=0)
    for (px, py), (qx, qy), label in ((points[0], points[1], a), (points[-1], points[-2], b)):
        dx, dy = qx - px, qy - py
        n = max((dx * dx + dy * dy) ** 0.5, 1e-9)
        ax.text(px + dx / n * 0.011 - dy / n * 0.01, py + dy / n * 0.011 + dx / n * 0.01, label,
                ha="center", va="center", fontsize=7.5, fontweight="bold", color="#333333")


table("notifications", 0, 0.93, ["id PK (UUIDv7)", "type", "notifiable_id FK (+ type)", "data (message, url, ids)", "read_at, created_at"])
table("users", 1, 0.93, ["id PK", "name", "email (unique)", "password (bcrypt)", "role", "is_active", "consented_at",
                         "display_prefs (JSON)", "email_notifications"])
table("employers", 2, 0.93, ["id PK", "user_id FK (unique)", "company_name", "business_reg_no, registry_type",
                             "industry, address", "location_psgc, location_label", "description, logo_path",
                             "verified_at", "verification_rejected_reason", "trust_score, feedback_count"])
table("registry_checks", 3, 0.93, ["id PK", "employer_id FK", "checked_by FK → users", "business_reg_no, registry_type",
                                   "status", "registered_name", "name_match_score", "raw_response (XML)", "checked_at"])
table("candidate_profiles", 0, 0.72, ["id PK", "user_id FK (unique)", "headline, skills (JSON)", "experience",
                                      "location_psgc, location_label", "disability_type (optional)", "show_disability",
                                      "resume_path"])
table("saved_jobs", 1, 0.72, ["candidate_profile_id PK FK", "job_posting_id PK FK"], pivot=True)
table("job_postings", 2, 0.72, ["id PK", "employer_id FK", "category_id FK", "title, description", "address",
                                "location_psgc, location_label", "employment_type, work_setup", "interview_format",
                                "status, is_approved", "closes_at", "rejection_reason", "deleted_at (soft delete)"])
table("categories", 3, 0.72, ["id PK", "name"])
table("candidate_accommodation", 0, 0.47, ["candidate_profile_id PK FK", "accommodation_id PK FK"], pivot=True)
table("applications", 1, 0.47, ["id PK", "job_posting_id FK", "candidate_profile_id FK", "UNIQUE (posting, candidate)",
                                "status", "cover_note, interview_request", "reviewed_at, hired_at", "hire_confirmed_by",
                                "feedback_reminded_at"])
table("reports", 2, 0.47, ["id PK", "reporter_id FK → users", "job_posting_id FK", "reason", "status, note",
                           "resolved_by FK → users", "resolved_at"])
table("job_posting_accommodation", 3, 0.47, ["job_posting_id PK FK", "accommodation_id PK FK", "note"], pivot=True)
table("accommodations", 0, 0.28, ["id PK", "name", "group", "description", "is_retired"])
table("application_accommodation", 1, 0.28, ["application_id PK FK", "accommodation_id PK FK"], pivot=True)
table("feedback", 2, 0.28, ["id PK", "application_id FK (unique)", "comments", "is_hidden"])
table("feedback_items", 3, 0.28, ["id PK", "feedback_id FK", "accommodation_id FK", "rating"])

# users
rel([side("users", "left", 0.25), side("notifications", "right", 0.25)], "1", "N")
rel([side("users", "right", 0.2), (COLS[2], side("users", "right", 0.2)[1])], "1", "1")
rel([side("users", "bottom", 0.15), side("candidate_profiles", "top", 0.8)], "1", "1")
rel([side("users", "top", 0.6), (side("users", "top", 0.6)[0], 0.952), (side("registry_checks", "top", 0.5)[0], 0.952),
     side("registry_checks", "top", 0.5)], "1", "N")
users_bottom = side("users", "bottom", 0.9)
rel([users_bottom, (users_bottom[0], 0.745), (0.50, 0.745), (0.50, side("reports", "left", 0.3)[1]),
     side("reports", "left", 0.3)], "1", "N")
# employers, postings
rel([side("employers", "right", 0.3), side("registry_checks", "left", 0.3)], "1", "N")
rel([side("employers", "bottom", 0.5), side("job_postings", "top", 0.5)], "1", "N")
rel([side("categories", "left", 0.5), (COLS[2] + BW, side("categories", "left", 0.5)[1])], "1", "N")
rel([side("job_postings", "bottom", 0.5), side("reports", "top", 0.5)], "1", "N")
rel([side("job_postings", "bottom", 0.9), side("job_posting_accommodation", "top", 0.3)], "1", "N")
rel([side("job_postings", "left", 0.15), (COLS[1] + BW, side("job_postings", "left", 0.15)[1])], "1", "N")
rel([side("job_postings", "bottom", 0.08), side("applications", "top", 0.9)], "1", "N")
# candidates
rel([side("candidate_profiles", "right", 0.15), (COLS[1], side("candidate_profiles", "right", 0.15)[1])], "1", "N")
rel([side("candidate_profiles", "bottom", 0.5), side("candidate_accommodation", "top", 0.5)], "1", "N")
rel([side("candidate_profiles", "bottom", 0.92), side("applications", "top", 0.1)], "1", "N")
# applications, feedback
rel([side("applications", "bottom", 0.5), side("application_accommodation", "top", 0.5)], "1", "N")
rel([side("applications", "bottom", 0.92), side("feedback", "top", 0.1)], "1", "1")
rel([side("feedback", "right", 0.4), side("feedback_items", "left", 0.4)], "1", "N")
# accommodations
rel([side("accommodations", "top", 0.5), side("candidate_accommodation", "bottom", 0.5)], "1", "N")
rel([side("accommodations", "right", 0.3), (COLS[1], side("accommodations", "right", 0.3)[1])], "1", "N")
acc_bottom = side("accommodations", "bottom", 0.35)
jpa_left = side("job_posting_accommodation", "left", 0.6)
rel([acc_bottom, (acc_bottom[0], 0.15), (0.75, 0.15), (0.75, jpa_left[1]), jpa_left], "1", "N")
acc_bottom2 = side("accommodations", "bottom", 0.7)
rel([acc_bottom2, (acc_bottom2[0], 0.165), (side("feedback_items", "bottom", 0.5)[0], 0.165),
     side("feedback_items", "bottom", 0.5)], "1", "N")
ax.text(0.5, 0.11, "PK primary key · FK foreign key · 1 / N cardinality at each end · grey title = pivot table\n"
        "Not shown: Laravel tables personal_access_tokens, password_reset_tokens, jobs / failed_jobs, cache, sessions",
        ha="center", va="center", fontsize=7.5, color="#555555")
save(fig, "fig6_erd.png", tight=True)
print("done")
