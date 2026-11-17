"use strict";

const dashboard = document.querySelector(".analytics-dashboard");
const analyticsMessage = document.getElementById("analyticsMessage");
const refreshButton = document.getElementById("refreshAnalytics");

const charts = {};

const currency = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
});

const compactCurrency = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1
});

const numberFormat = new Intl.NumberFormat("en-IN");

const PRIMARY = "#4f46e5";

const GENRE_COLORS = [
    "#4f46e5",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#06b6d4",
    "#a855f7",
    "#64748b"
];

const STATUS_COLORS = {
    pending: "#f59e0b",
    confirmed: "#6366f1",
    shipped: "#06b6d4",
    delivered: "#10b981",
    cancelled: "#ef4444",
    canceled: "#ef4444"
};


// --------------------
// HELPERS
// --------------------

function sumOf(list, key) {
    return list.reduce(
        (total, item) => total + (Number(item[key]) || 0),
        0
    );
}

function formatDay(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value ?? "");
    }

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short"
    });
}

function statusLabel(status) {
    return String(status || "Unknown")
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, character => character.toUpperCase());
}

function statusColor(status) {
    return STATUS_COLORS[String(status || "").toLowerCase()] || "#94a3b8";
}

function truncate(text, max) {
    const value = String(text ?? "");

    return value.length > max
        ? `${value.slice(0, max - 1)}…`
        : value;
}

function setText(id, text) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = text;
    }
}

function setEmpty(canvasId, isEmpty) {
    const box = document.getElementById(canvasId)?.parentElement;

    if (box) {
        box.classList.toggle("is-empty", isEmpty);
    }
}

function normalize(analytics) {
    const data = analytics || {};

    return {
        revenueTimeline: Array.isArray(data.revenueTimeline) ? data.revenueTimeline : [],
        salesByGenre: Array.isArray(data.salesByGenre) ? data.salesByGenre : [],
        topBooks: Array.isArray(data.topBooks) ? data.topBooks : [],
        orderStatuses: Array.isArray(data.orderStatuses) ? data.orderStatuses : []
    };
}


// --------------------
// SUMMARY CARDS
// --------------------

function updateKpis(analytics) {
    const { revenueTimeline, salesByGenre, topBooks, orderStatuses } = analytics;

    // Revenue
    const revenue = sumOf(revenueTimeline, "revenue");
    const days = revenueTimeline.length;

    setText("kpiRevenue", currency.format(revenue));
    setText(
        "kpiRevenueSub",
        days
            ? `${currency.format(revenue / days)} average per day`
            : "No revenue yet"
    );

    // Orders
    const totalOrders = sumOf(orderStatuses, "count");

    const delivered = orderStatuses
        .filter(item => String(item.status).toLowerCase() === "delivered")
        .reduce((total, item) => total + (Number(item.count) || 0), 0);

    const pending = orderStatuses
        .filter(item => String(item.status).toLowerCase() === "pending")
        .reduce((total, item) => total + (Number(item.count) || 0), 0);

    setText("kpiOrders", numberFormat.format(totalOrders));
    setText(
        "kpiOrdersSub",
        totalOrders
            ? `${numberFormat.format(delivered)} delivered · ${numberFormat.format(pending)} pending`
            : "No orders yet"
    );

    // Copies sold
    const copies = sumOf(salesByGenre, "quantity");

    setText("kpiCopies", numberFormat.format(copies));
    setText(
        "kpiCopiesSub",
        salesByGenre.length
            ? `Across ${salesByGenre.length} ${salesByGenre.length === 1 ? "genre" : "genres"}`
            : "No sales yet"
    );

    // Best seller
    const best = topBooks[0];

    setText("kpiBest", best ? best.title : "—");
    setText(
        "kpiBestSub",
        best
            ? `${numberFormat.format(best.quantity)} ${Number(best.quantity) === 1 ? "copy" : "copies"} sold`
            : "No book sales yet"
    );
}


// --------------------
// CHART SETUP
// --------------------

function applyChartDefaults() {
    Chart.defaults.font.family =
        getComputedStyle(document.body).fontFamily || "sans-serif";

    Chart.defaults.font.size = 12;
    Chart.defaults.color = "#6b7280";

    const tooltip = Chart.defaults.plugins.tooltip;

    tooltip.backgroundColor = "#111827";
    tooltip.padding = 12;
    tooltip.cornerRadius = 10;
    tooltip.titleFont = { weight: "600", size: 12 };
    tooltip.bodyFont = { size: 12 };
    tooltip.boxPadding = 4;

    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.boxWidth = 8;
    Chart.defaults.plugins.legend.labels.padding = 16;
}

// text in the middle of the doughnut
const centerText = {
    id: "centerText",

    afterDraw(chart) {
        const options = chart.options.plugins.centerText;

        if (!options || options.value === undefined) {
            return;
        }

        const { ctx, chartArea } = chart;

        const x = (chartArea.left + chartArea.right) / 2;
        const y = (chartArea.top + chartArea.bottom) / 2;

        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.fillStyle = "#111827";
        ctx.font = `800 26px ${Chart.defaults.font.family}`;
        ctx.fillText(options.value, x, y - 8);

        ctx.fillStyle = "#6b7280";
        ctx.font = `500 12px ${Chart.defaults.font.family}`;
        ctx.fillText(options.label || "", x, y + 16);

        ctx.restore();
    }
};

function revenueGradient(context) {
    const { chart } = context;
    const { ctx, chartArea } = chart;

    if (!chartArea) {
        return "rgba(79, 70, 229, 0.12)";
    }

    const gradient = ctx.createLinearGradient(
        0, chartArea.top, 0, chartArea.bottom
    );

    gradient.addColorStop(0, "rgba(79, 70, 229, 0.28)");
    gradient.addColorStop(1, "rgba(79, 70, 229, 0)");

    return gradient;
}

function buildStatusData(orderStatuses) {
    return {
        labels: orderStatuses.map(item => statusLabel(item.status)),
        counts: orderStatuses.map(item => Number(item.count) || 0),
        colors: orderStatuses.map(item => statusColor(item.status))
    };
}


// --------------------
// CREATE CHARTS (first load)
// --------------------

function createCharts(analytics) {
    applyChartDefaults();

    // 1. Revenue timeline
    charts.revenue = new Chart(
        document.getElementById("revenueChart"),
        {
            type: "line",
            data: {
                labels: analytics.revenueTimeline.map(item => formatDay(item.date)),
                datasets: [{
                    label: "Revenue",
                    data: analytics.revenueTimeline.map(item => Number(item.revenue) || 0),
                    borderColor: PRIMARY,
                    borderWidth: 2.5,
                    backgroundColor: revenueGradient,
                    fill: true,
                    tension: 0.35,
                    pointRadius: 4,
                    pointHoverRadius: 7,
                    pointBackgroundColor: "#fff",
                    pointBorderColor: PRIMARY,
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        displayColors: false,
                        callbacks: {
                            label: context => currency.format(context.parsed.y)
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        border: { display: false }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: "#eef0f4" },
                        border: { display: false },
                        ticks: {
                            maxTicksLimit: 6,
                            callback: value => compactCurrency.format(value)
                        }
                    }
                }
            }
        }
    );

    // 2. Sales by genre
    const genreTotal = sumOf(analytics.salesByGenre, "quantity");

    charts.genre = new Chart(
        document.getElementById("genreChart"),
        {
            type: "doughnut",
            plugins: [centerText],
            data: {
                labels: analytics.salesByGenre.map(item => item.genre),
                datasets: [{
                    label: "Copies sold",
                    data: analytics.salesByGenre.map(item => Number(item.quantity) || 0),
                    backgroundColor: GENRE_COLORS,
                    borderColor: "#fff",
                    borderWidth: 3,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "68%",
                plugins: {
                    legend: { position: "bottom" },
                    centerText: {
                        value: numberFormat.format(genreTotal),
                        label: "copies sold"
                    },
                    tooltip: {
                        callbacks: {
                            label: context => {
                                const values = context.dataset.data;

                                const total = values.reduce(
                                    (sum, value) => sum + value, 0
                                );

                                const percentage = total
                                    ? (context.parsed / total * 100).toFixed(1)
                                    : "0.0";

                                return `${context.label}: ${context.parsed} copies (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        }
    );

    // 3. Top 5 books
    charts.topBooks = new Chart(
        document.getElementById("topBooksChart"),
        {
            type: "bar",
            data: {
                labels: analytics.topBooks.map(item => item.title),
                datasets: [{
                    label: "Copies sold",
                    data: analytics.topBooks.map(item => Number(item.quantity) || 0),
                    backgroundColor: "#6366f1",
                    hoverBackgroundColor: "#4338ca",
                    borderRadius: 8,
                    borderSkipped: false,
                    barThickness: 22
                }]
            },
            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { displayColors: false }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: { color: "#eef0f4" },
                        border: { display: false },
                        ticks: { precision: 0 }
                    },
                    y: {
                        grid: { display: false },
                        border: { display: false },
                        ticks: {
                            callback(value) {
                                return truncate(this.getLabelForValue(value), 24);
                            }
                        }
                    }
                }
            }
        }
    );

    // 4. Order status
    const status = buildStatusData(analytics.orderStatuses);

    charts.status = new Chart(
        document.getElementById("statusChart"),
        {
            type: "bar",
            data: {
                labels: status.labels,
                datasets: [{
                    label: "Orders",
                    data: status.counts,
                    backgroundColor: status.colors,
                    borderRadius: 8,
                    borderSkipped: false,
                    maxBarThickness: 46
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { displayColors: false }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        border: { display: false }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: "#eef0f4" },
                        border: { display: false },
                        ticks: { precision: 0 }
                    }
                }
            }
        }
    );
}


// --------------------
// UPDATE CHARTS (refresh)
// --------------------

function updateCharts(analytics) {
    const revenue = charts.revenue;
    revenue.data.labels = analytics.revenueTimeline.map(item => formatDay(item.date));
    revenue.data.datasets[0].data =
        analytics.revenueTimeline.map(item => Number(item.revenue) || 0);
    revenue.update();

    const genre = charts.genre;
    genre.data.labels = analytics.salesByGenre.map(item => item.genre);
    genre.data.datasets[0].data =
        analytics.salesByGenre.map(item => Number(item.quantity) || 0);
    genre.options.plugins.centerText.value =
        numberFormat.format(sumOf(analytics.salesByGenre, "quantity"));
    genre.update();

    const topBooks = charts.topBooks;
    topBooks.data.labels = analytics.topBooks.map(item => item.title);
    topBooks.data.datasets[0].data =
        analytics.topBooks.map(item => Number(item.quantity) || 0);
    topBooks.update();

    const status = buildStatusData(analytics.orderStatuses);
    charts.status.data.labels = status.labels;
    charts.status.data.datasets[0].data = status.counts;
    charts.status.data.datasets[0].backgroundColor = status.colors;
    charts.status.update();
}

function updateEmptyStates(analytics) {
    setEmpty("revenueChart", sumOf(analytics.revenueTimeline, "revenue") === 0);
    setEmpty("genreChart", sumOf(analytics.salesByGenre, "quantity") === 0);
    setEmpty("topBooksChart", analytics.topBooks.length === 0);
    setEmpty("statusChart", sumOf(analytics.orderStatuses, "count") === 0);
}


// --------------------
// LOAD ANALYTICS
// --------------------

function showMessage(text, isError = false) {
    analyticsMessage.textContent = text;
    analyticsMessage.classList.toggle("is-error", isError);
}

async function loadAnalytics() {
    refreshButton.disabled = true;
    dashboard.classList.add("is-loading");
    showMessage("Loading analytics...");

    try {
        if (typeof Chart === "undefined") {
            throw new Error(
                "Chart.js did not load. Check your internet connection."
            );
        }

        const response = await fetch("/admin/api/analytics", {
            method: "GET",
            credentials: "same-origin",
            headers: {
                Accept: "application/json"
            },
            cache: "no-store"
        });

        const contentType = response.headers.get("content-type") || "";

        if (!contentType.includes("application/json")) {
            throw new Error(
                `Expected JSON but received ${contentType || "an unknown response type"}. Check your admin authentication and API route.`
            );
        }

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Unable to load analytics.");
        }

        const analytics = normalize(result.analytics);

        updateKpis(analytics);
        updateEmptyStates(analytics);

        if (Object.keys(charts).length === 0) {
            createCharts(analytics);
        } else {
            updateCharts(analytics);
        }

        const time = new Date().toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit"
        });

        showMessage(`Updated at ${time}`);
    } catch (error) {
        console.error("Analytics loading error:", error);

        showMessage(
            error.message || "Failed to load analytics.",
            true
        );
    } finally {
        refreshButton.disabled = false;
        dashboard.classList.remove("is-loading");
    }
}

refreshButton.addEventListener("click", loadAnalytics);

loadAnalytics();