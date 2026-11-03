"use strict";
const analyticsMessage = document.getElementById("analyticsMessage")
const refreshButton = document.getElementById("refreshAnalytics")

const charts= {};
const currency = new Intl.NumberFormat("en-IN",{
    style:"currency",
    currency:"INR",
    maximumFractionDigits:2
});

function createCharts(analytics){
    // Chart 1: Revenue Timeline
    charts.revenue = new Chart(
        document.getElementById("revenueChart"),
        {
            type:"line",
            data:{
                labels:analytics.revenueTimeline.map(item=>item.date),
                datasets:[{
                    label:"Revenue",
                    data:analytics.revenueTimeline.map(item=>item.revenue),
                    borderColor: "#4f46e5",
                    backgroundColor: "rgba(79, 70, 229, 0.12)",
                    fill: true,
                    tension: 0.3
            }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: context =>
                                currency.format(context.parsed.y)
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: value => currency.format(value)
                        }
                    }
                }
            }
        }
    );
        // Chart 2: Sales by Genre
    charts.genre = new Chart(
        document.getElementById("genreChart"),
        {
            type: "doughnut",
            data: {
                labels: analytics.salesByGenre.map(item => item.genre),
                datasets: [{
                    label: "Copies sold",
                    data: analytics.salesByGenre.map(item => item.quantity),
                    backgroundColor: [
                        "#4f46e5",
                        "#10b981",
                        "#f59e0b",
                        "#ef4444",
                        "#06b6d4",
                        "#a855f7",
                        "#64748b"
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
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

    // Chart 3: Top 5 Books
    charts.topBooks = new Chart(
        document.getElementById("topBooksChart"),
        {
            type: "bar",
            data: {
                labels: analytics.topBooks.map(item => item.title),
                datasets: [{
                    label: "Copies sold",
                    data: analytics.topBooks.map(item => item.quantity),
                    backgroundColor: "#6366f1",
                    borderRadius: 6
                }]
            },
            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { precision: 0 }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        }
    );

    // Chart 4: Order Status Distribution
    charts.status = new Chart(
        document.getElementById("statusChart"),
        {
            type: "polarArea",
            data: {
                labels: analytics.orderStatuses.map(item => item.status),
                datasets: [{
                    data: analytics.orderStatuses.map(item => item.count),
                    backgroundColorbackgroundColor: [
                            "rgba(245, 158, 11, 0.75)",  // Pending
                            "rgba(99, 102, 241, 0.75)",  // Confirmed
                            "rgba(6, 182, 212, 0.75)",   // Shipped
                            "rgba(16, 185, 129, 0.75)"   // Delivered
]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        beginAtZero: true,
                        ticks: { precision: 0 }
                    }
                }
            }
        }
    );
}

function updateCharts(analytics) {
    const revenue = charts.revenue;
    revenue.data.labels = analytics.revenueTimeline.map(item => item.date);
    revenue.data.datasets[0].data =
        analytics.revenueTimeline.map(item => item.revenue);
    revenue.update();

    const genre = charts.genre;
    genre.data.labels = analytics.salesByGenre.map(item => item.genre);
    genre.data.datasets[0].data =
        analytics.salesByGenre.map(item => item.quantity);
    genre.update();

    const topBooks = charts.topBooks;
    topBooks.data.labels = analytics.topBooks.map(item => item.title);
    topBooks.data.datasets[0].data =
        analytics.topBooks.map(item => item.quantity);
    topBooks.update();

    const status = charts.status;
    status.data.labels = analytics.orderStatuses.map(item => item.status);
    status.data.datasets[0].data =
        analytics.orderStatuses.map(item => item.count);
    status.update();
}

async function loadAnalytics() {
    refreshButton.disabled = true;
    analyticsMessage.textContent = "Loading analytics...";

    try {
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

        if (Object.keys(charts).length === 0) {
            createCharts(result.analytics);
        } else {
            updateCharts(result.analytics);
        }

        analyticsMessage.textContent = "Analytics updated successfully.";
    } catch (error) {
        console.error("Analytics loading error:", error);
        analyticsMessage.textContent =
            error.message || "Failed to load analytics.";
    } finally {
        refreshButton.disabled = false;
    }
}

refreshButton.addEventListener("click", loadAnalytics);

loadAnalytics();

