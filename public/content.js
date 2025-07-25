document.addEventListener('DOMContentLoaded', () => {
    const generalFilter = document.getElementById('general-filter');
    const categoriesFilter = document.getElementById('categories-filter');
    const sortBySelect = document.getElementById('sort-by');
    const sortDirectionToggle = document.querySelector('.sort-direction-toggle');
    const errorContainer = document.getElementById('error-container');
    const contentTypeToggle = document.querySelector('.content-type-toggle');
    const contentTableBody = document.querySelector('#content-table tbody');
    const contentTableTitle = document.getElementById('content-table-title');
    const tableInfo = document.getElementById('table-info');
    const pageInfo = document.getElementById('page-info');
    const firstPageBtn = document.getElementById('first-page');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const lastPageBtn = document.getElementById('last-page');
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');

    const token = localStorage.getItem('corkyTubeToken');
    let currentPage = 1;
    let totalPages = 1;
    const rowsPerPage = 10;

    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    function displayError(message) {
        errorContainer.textContent = message;
        errorContainer.style.display = 'block';
    }

    async function searchContent(page = 1) {
        const searchTerm = searchInput.value.trim();
        if (!searchTerm) {
            fetchAndRenderContent(); // If search is cleared, fetch all content
            return;
        }

        currentPage = page;

        try {
            const url = `/api/search?term=${encodeURIComponent(searchTerm)}&page=${currentPage}&limit=${rowsPerPage}`;
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to fetch search results.');
                } else {
                    const errorText = await response.text();
                    throw new Error(`Server error: ${errorText}`);
                }
            }

            const data = await response.json();
            if (data.content.length === 0) {
                alert('No videos or shorts found matching your search criteria.');
            } else {
                renderContent(data.content);
                updatePagination(data.totalCount);
            }

        } catch (err) {
            console.error('Error searching content:', err);
            displayError(err.message);
        }
    }

    async function fetchAndRenderContent() {
        searchInput.value = ''; // Clear search input
        const activeTypeToggle = contentTypeToggle.querySelector('.toggle-btn.active');
        const type = activeTypeToggle ? activeTypeToggle.dataset.type : 'both';
        const sortBy = sortBySelect.value;
        const activeDirectionToggle = sortDirectionToggle.querySelector('.toggle-btn.active');
        const sortDirection = activeDirectionToggle ? activeDirectionToggle.dataset.direction : 'DESC';
        const category = categoriesFilter.value;
        const generalFilterValue = generalFilter.value;

        let title = type.charAt(0).toUpperCase() + type.slice(1);
        if (type === 'videos') title = 'Videos';
        if (type === 'shorts') title = 'Shorts';
        if (type === 'both') title = 'Videos and Shorts';
        contentTableTitle.textContent = title;

        try {
            const url = `/api/content?type=${type}&sortBy=${sortBy}&sortDirection=${sortDirection}&category=${category}&generalFilter=${generalFilterValue}&page=${currentPage}&limit=${rowsPerPage}`;
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to fetch content.');
                } else {
                    const errorText = await response.text();
                    throw new Error(`Server error: ${errorText}`);
                }
            }

            const data = await response.json();
            renderContent(data.content);
            updatePagination(data.totalCount);

        } catch (err) {
            console.error('Error fetching content:', err);
            displayError(err.message);
        }
    }

    function renderContent(content) {
        contentTableBody.innerHTML = '';

        if (!content || content.length === 0) {
            contentTableBody.innerHTML = '<tr><td colspan="5">No content found for the selected filters.</td></tr>';
            return;
        }

        content.forEach(item => {
            const row = document.createElement('tr');
            const publishedDate = new Date(item.published_at);
            const formattedDate = `${publishedDate.getDate().toString().padStart(2, '0')}.${(publishedDate.getMonth() + 1).toString().padStart(2, '0')}.${publishedDate.getFullYear()}`;

            row.innerHTML = `
                <td>
                    <img src="${item.thumbnail}" alt="Thumbnail">
                    <div class="published-date">${formattedDate}</div>
                </td>
                <td>${item.title}</td>
                <td>${(item.views || 0).toLocaleString()}</td>
                <td>${(item.likes || 0).toLocaleString()}</td>
                <td class="actions">
                    <button class="action-btn play-btn" data-video-id="${item.id}" title="Watch on YouTube">
                        <i class="fas fa-play"></i>
                    </button>
                    <button class="action-btn favorite-btn ${item.is_favorited ? 'favorited' : ''}" data-video-id="${item.id}" title="Add to favorites">
                        <i class="fas fa-star"></i>
                    </button>
                </td>
            `;
            contentTableBody.appendChild(row);
        });
    }

    function updatePagination(totalCount) {
        totalPages = Math.ceil(totalCount / rowsPerPage);
        const startRow = (currentPage - 1) * rowsPerPage + 1;
        const endRow = Math.min(currentPage * rowsPerPage, totalCount);

        if (totalCount > 0) {
            tableInfo.textContent = `Showing ${startRow}-${endRow} of ${totalCount}`;
            pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        } else {
            tableInfo.textContent = 'No results';
            pageInfo.textContent = 'Page 1 of 1';
        }

        firstPageBtn.disabled = currentPage === 1;
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage >= totalPages;
        lastPageBtn.disabled = currentPage >= totalPages;
    }
    
    function updateSortBasedOnGeneralFilter() {
        const generalFilterValue = generalFilter.value;
        const currentSortDirection = sortDirectionToggle.querySelector('.toggle-btn.active').dataset.direction;

        // Remove active class from current sort direction buttons
        sortDirectionToggle.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active'));

        if (generalFilterValue === 'most_viewed') {
            sortBySelect.value = 'views';
            // Set descending for most viewed by default
            sortDirectionToggle.querySelector('[data-direction="DESC"]').classList.add('active');
        } else if (generalFilterValue === 'most_liked') {
            sortBySelect.value = 'likes';
            // Set descending for most liked by default
            sortDirectionToggle.querySelector('[data-direction="DESC"]').classList.add('active');
        } else if (generalFilterValue === 'newest') {
            sortBySelect.value = 'published_at';
            // Set descending for newest by default
            sortDirectionToggle.querySelector('[data-direction="DESC"]').classList.add('active');
        } else {
            // For 'favorites' or any other general filter, revert to default sort or keep current
            // Re-add the active class to the previously active sort direction button
            sortDirectionToggle.querySelector(`[data-direction="${currentSortDirection}"]`).classList.add('active');
        }
    }

    function handleFilterChange() {
        currentPage = 1;
        fetchAndRenderContent();
    }

    async function toggleFavorite(videoId, button) {
        const isFavorited = button.classList.contains('favorited');
        const method = isFavorited ? 'DELETE' : 'POST';
        const url = isFavorited ? `/api/favorites/${videoId}` : '/api/favorites';

        try {
            await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: method === 'POST' ? JSON.stringify({ videoId }) : null
            });
            button.classList.toggle('favorited');
        } catch (err) {
            console.error('Favorite error:', err);
            displayError('Could not update favorite status.');
        }
    }

    // --- Event Listeners ---
    searchButton.addEventListener('click', () => searchContent(1));
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchContent(1);
        }
    });

    categoriesFilter.addEventListener('change', handleFilterChange);
    sortBySelect.addEventListener('change', handleFilterChange);
    generalFilter.addEventListener('change', () => {
        updateSortBasedOnGeneralFilter();
        handleFilterChange();
    });

    sortDirectionToggle.addEventListener('click', (e) => {
        const clickedButton = e.target.closest('.toggle-btn');
        if (!clickedButton || clickedButton.classList.contains('active')) return;

        sortDirectionToggle.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active'));
        clickedButton.classList.add('active');
        
        handleFilterChange();
    });

    contentTypeToggle.addEventListener('click', (e) => {
        const clickedButton = e.target.closest('.toggle-btn');
        if (!clickedButton || clickedButton.classList.contains('active')) return;

        contentTypeToggle.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active'));
        clickedButton.classList.add('active');
        
        handleFilterChange();
    });

    contentTableBody.addEventListener('click', (e) => {
        const playBtn = e.target.closest('.play-btn');
        const favoriteBtn = e.target.closest('.favorite-btn');

        if (playBtn) {
            window.open(`https://www.youtube.com/watch?v=${playBtn.dataset.videoId}`, '_blank');
        }

        if (favoriteBtn) {
            toggleFavorite(favoriteBtn.dataset.videoId, favoriteBtn);
        }
    });

    firstPageBtn.addEventListener('click', () => {
        if (currentPage !== 1) {
            currentPage = 1;
            if (searchInput.value.trim()) {
                searchContent(currentPage);
            } else {
                fetchAndRenderContent();
            }
        }
    });

    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            if (searchInput.value.trim()) {
                searchContent(currentPage);
            } else {
                fetchAndRenderContent();
            }
        }
    });

    nextPageBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            if (searchInput.value.trim()) {
                searchContent(currentPage);
            } else {
                fetchAndRenderContent();
            }
        }
    });

    lastPageBtn.addEventListener('click', () => {
        if (currentPage !== totalPages) {
            currentPage = totalPages;
            if (searchInput.value.trim()) {
                searchContent(currentPage);
            } else {
                fetchAndRenderContent();
            }
        }
    });

    // --- Initial Load ---
    async function init() {
        await fetchAndRenderContent();
    }

    init();

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