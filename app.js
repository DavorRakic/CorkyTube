document.addEventListener('DOMContentLoaded', () => {
    const subscribersCountElem = document.getElementById('subscribers-count');
    const totalVideosCountElem = document.getElementById('total-videos-count');
    const totalShortsCountElem = document.getElementById('total-shorts-count');
    const totalViewsCountElem = document.getElementById('total-views-count');
    const totalLikesCountElem = document.getElementById('total-likes-count');
    const errorContainer = document.getElementById('error-container');

    const token = localStorage.getItem('corkyTubeToken');

    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    function displayError(message) {
        errorContainer.textContent = message;
        errorContainer.style.display = 'block';
    }

    async function fetchDashboardData() {
        console.log('[app.js] fetchDashboardData called.');
        try {
            const response = await fetch('/api/dashboard', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            console.log('[app.js] Response received:', response);

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    console.warn('[app.js] Unauthorized or Forbidden, redirecting to login.');
                    window.location.href = 'login.html';
                    return;
                }
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    const errorData = await response.json();
                    console.error('[app.js] API Error response:', errorData);
                    throw new Error(errorData.message || 'Failed to fetch dashboard data.');
                } else {
                    const errorText = await response.text();
                    console.error('[app.js] Server error (non-JSON response):', errorText);
                    throw new Error(`Server error: ${errorText}`);
                }
            }

            const data = await response.json();
            console.log('[app.js] Dashboard data parsed:', data);

            subscribersCountElem.textContent = data.subscribers_count.toLocaleString();
            totalVideosCountElem.textContent = data.total_videos.toLocaleString();
            totalShortsCountElem.textContent = data.total_shorts.toLocaleString();
            totalViewsCountElem.textContent = data.total_views.toLocaleString();
            totalLikesCountElem.textContent = data.total_likes.toLocaleString();

            // Process and render charts
            renderCharts(data.video_categories, data.shorts_categories);

        } catch (err) {
            console.error('Error fetching dashboard data:', err);
            displayError(err.message);
        }
    }

    function renderCharts(videoCategories, shortsCategories) {
        const categoryLabels = ['Emerging', 'Growing', 'Popular', 'Trending', 'Viral'];
        const categoryColors = ['#4CAF50', '#2196F3', '#FFC107', '#FF5722', '#9C27B0'];

        // Helper to prepare chart data
        const prepareChartData = (categories) => {
            const data = categoryLabels.map(label => categories[label] || 0);
            const total = data.reduce((sum, val) => sum + val, 0);
            const percentages = data.map(val => total > 0 ? ((val / total) * 100).toFixed(2) : 0);
            
            return {
                labels: categoryLabels.map((label, index) => `${label} (${percentages[index]}%)`),
                datasets: [{
                    data: data,
                    backgroundColor: categoryColors,
                    hoverOffset: 4
                }]
            };
        };

        // Videos Pie Chart
        new Chart(document.getElementById('videosPieChart'), {
            type: 'pie',
            data: prepareChartData(videoCategories),
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed !== null) {
                                    label += `${context.parsed.toLocaleString()} views`;
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });

        // Shorts Pie Chart
        new Chart(document.getElementById('shortsPieChart'), {
            type: 'pie',
            data: prepareChartData(shortsCategories),
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed !== null) {
                                    label += `${context.parsed.toLocaleString()} views`;
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    }

    fetchDashboardData();

    async function fetchLastUpdated() {
        try {
            const response = await fetch('/api/last-updated', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to fetch last updated timestamp.');
                } else {
                    const errorText = await response.text();
                    throw new Error(`Server error: ${errorText}`);
                }
            }
            const data = await response.json();
            if (data.last_updated) {
                const lastUpdatedElem = document.getElementById('last-updated-value');
                const date = new Date(data.last_updated);
                const year = date.getFullYear();
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const day = date.getDate().toString().padStart(2, '0');
                const hours = date.getHours().toString().padStart(2, '0');
                const minutes = date.getMinutes().toString().padStart(2, '0');
                const today = new Date();
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);

                let formattedDate;
                if (date.toDateString() === today.toDateString()) {
                    formattedDate = `Today at ${hours}:${minutes}`;
                } else if (date.toDateString() === yesterday.toDateString()) {
                    formattedDate = `Yesterday at ${hours}:${minutes}`;
                } else {
                    formattedDate = `${year}-${month}-${day} ${hours}:${minutes}`;
                }
                lastUpdatedElem.textContent = formattedDate;
            }
        } catch (err) {
            console.error('Error fetching last updated timestamp:', err);
        }
    }

    fetchLastUpdated();
});