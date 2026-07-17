/**
 * BigQuery Release Notes Dashboard - Frontend Application
 * Handles API calls, state management, searches, filters, selection, and Twitter integration.
 */

// Application State
const state = {
    updates: [],
    selectedIds: new Set(),
    activeCategory: 'all',
    searchQuery: '',
    lastFetched: '',
    isLoading: false
};

// DOM Elements
const elements = {
    btnRefresh: document.getElementById('btn-refresh'),
    syncTimeText: document.getElementById('sync-time-text'),
    searchInput: document.getElementById('search-input'),
    searchClear: document.getElementById('search-clear'),
    categoryPillsContainer: document.getElementById('category-pills-container'),
    selectionBar: document.getElementById('selection-bar'),
    selectionCountText: document.getElementById('selection-count-text'),
    btnSelectAll: document.getElementById('btn-select-all'),
    btnClearSelect: document.getElementById('btn-clear-select'),
    btnTweetSelected: document.getElementById('btn-tweet-selected'),
    notesContainer: document.getElementById('notes-container'),
    skeletonLoader: document.getElementById('skeleton-loader'),
    emptyState: document.getElementById('empty-state'),
    
    // Modal Elements
    tweetModal: document.getElementById('tweet-modal'),
    btnCloseTweetModal: document.getElementById('btn-close-tweet-modal'),
    btnCancelTweet: document.getElementById('btn-cancel-tweet'),
    btnPublishTweet: document.getElementById('btn-publish-tweet'),
    tweetTextarea: document.getElementById('tweet-textarea'),
    charCounter: document.getElementById('char-counter'),
    tweetPreviewText: document.getElementById('tweet-preview-text'),
    tweetLinkCard: document.getElementById('tweet-link-card'),
    toastContainer: document.getElementById('toast-container')
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    fetchReleaseNotes();
});

// Event Listeners Setup
function setupEventListeners() {
    // Refresh Button
    elements.btnRefresh.addEventListener('click', forceRefreshNotes);
    
    // Search Functionality
    elements.searchInput.addEventListener('input', handleSearchInput);
    elements.searchClear.addEventListener('click', clearSearch);
    
    // Selection Bar Buttons
    elements.btnSelectAll.addEventListener('click', selectAllVisible);
    elements.btnClearSelect.addEventListener('click', clearSelection);
    elements.btnTweetSelected.addEventListener('click', () => composeTweetFromSelection());
    
    // Modal Close
    elements.btnCloseTweetModal.addEventListener('click', closeTweetModal);
    elements.btnCancelTweet.addEventListener('click', closeTweetModal);
    elements.tweetModal.addEventListener('click', (e) => {
        if (e.target === elements.tweetModal) closeTweetModal();
    });
    
    // Tweet Composers Live Update
    elements.tweetTextarea.addEventListener('input', updateTweetPreview);
    
    // Publish Tweet Button
    elements.btnPublishTweet.addEventListener('click', publishTweet);
}

// Fetch Notes from API
async function fetchReleaseNotes(force = false) {
    if (state.isLoading) return;
    
    setLoadingState(true);
    
    const url = force ? '/api/notes/refresh' : '/api/notes';
    const options = force ? { method: 'POST' } : { method: 'GET' };
    
    try {
        const response = await fetch(url, options);
        const data = await response.json();
        
        if (data.success) {
            state.updates = data.updates;
            state.lastFetched = data.last_fetched;
            state.selectedIds.clear();
            
            updateSyncStatus();
            renderCategoryPills();
            renderReleaseNotes();
            updateSelectionBar();
            
            if (force) {
                showToast('Release notes successfully synced from BigQuery feed!', 'success');
            }
        } else {
            console.error('API Error:', data.error);
            showToast(`Failed to fetch release notes: ${data.error}`, 'error');
        }
    } catch (err) {
        console.error('Fetch error:', err);
        showToast('Network error while retrieving release notes.', 'error');
    } finally {
        setLoadingState(false);
    }
}

// Force Refresh
function forceRefreshNotes() {
    fetchReleaseNotes(true);
}

// Loading States Handler
function setLoadingState(loading) {
    state.isLoading = loading;
    const icon = elements.btnRefresh.querySelector('.btn-icon');
    
    if (loading) {
        icon.classList.add('spinning');
        elements.btnRefresh.disabled = true;
        
        // Show Skeleton, Hide Content
        elements.skeletonLoader.style.display = 'block';
        elements.notesContainer.style.display = 'none';
        elements.emptyState.style.display = 'none';
        
        const dot = document.querySelector('.status-dot');
        dot.className = 'status-dot loading';
        elements.syncTimeText.textContent = 'Syncing BQ Feed...';
    } else {
        icon.classList.remove('spinning');
        elements.btnRefresh.disabled = false;
        
        elements.skeletonLoader.style.display = 'none';
        
        const dot = document.querySelector('.status-dot');
        dot.className = 'status-dot green';
    }
}

// Update Sync Info Header
function updateSyncStatus() {
    if (state.lastFetched) {
        // Human readable time format
        elements.syncTimeText.textContent = `Synced: ${state.lastFetched}`;
    } else {
        elements.syncTimeText.textContent = 'Not synced';
    }
}

// Category Pills Renderer
function renderCategoryPills() {
    // Count items per category
    const counts = { all: state.updates.length };
    
    state.updates.forEach(u => {
        counts[u.type] = (counts[u.type] || 0) + 1;
    });
    
    // Clear container except initial pill
    elements.categoryPillsContainer.innerHTML = '';
    
    // Sort categories: "all" first, then alphabetically
    const categories = Object.keys(counts).sort((a, b) => {
        if (a === 'all') return -1;
        if (b === 'all') return 1;
        return a.localeCompare(b);
    });
    
    categories.forEach(cat => {
        const displayLabel = cat === 'all' ? 'All' : cat;
        const button = document.createElement('button');
        button.className = `pill ${state.activeCategory === cat ? 'active' : ''}`;
        button.setAttribute('data-category', cat);
        button.innerHTML = `${displayLabel} <span class="count">${counts[cat]}</span>`;
        
        button.addEventListener('click', () => {
            document.querySelectorAll('.category-pills .pill').forEach(p => p.classList.remove('active'));
            button.classList.add('active');
            state.activeCategory = cat;
            renderReleaseNotes();
        });
        
        elements.categoryPillsContainer.appendChild(button);
    });
}

// Main Release Notes Card Renderer
function renderReleaseNotes() {
    const filteredUpdates = getFilteredUpdates();
    
    // Clear container
    elements.notesContainer.innerHTML = '';
    
    if (filteredUpdates.length === 0) {
        elements.notesContainer.style.display = 'none';
        elements.emptyState.style.display = 'flex';
        return;
    }
    
    elements.notesContainer.style.display = 'grid';
    elements.emptyState.style.display = 'none';
    
    filteredUpdates.forEach(update => {
        const card = document.createElement('article');
        const isSelected = state.selectedIds.has(update.id);
        card.className = `note-card card ${isSelected ? 'selected' : ''}`;
        card.setAttribute('data-id', update.id);
        
        // CSS Badge class based on type
        const typeClass = `badge-${update.type.toLowerCase()}`;
        
        card.innerHTML = `
            <div class="card-selector" title="Select for Tweeting">
                <svg class="card-selector-icon"><use href="#icon-check"></use></svg>
            </div>
            <div class="card-header">
                <span class="badge ${typeClass}">${update.type}</span>
                <span class="note-date">
                    <svg class="date-icon"><use href="#icon-calendar"></use></svg>
                    <span>${update.date}</span>
                </span>
            </div>
            <div class="card-body">
                ${update.content}
            </div>
            <div class="card-footer">
                <div class="card-footer-left">
                    <button class="btn-card-action tweet" title="Tweet this update">
                        <svg class="card-action-icon"><use href="#icon-twitter"></use></svg>
                    </button>
                    <button class="btn-card-action copy" title="Copy plain text to clipboard">
                        <svg class="card-action-icon"><use href="#icon-copy"></use></svg>
                    </button>
                </div>
                <a href="${update.link}" class="original-link" target="_blank" rel="noopener noreferrer">
                    <span>Source Feed</span>
                    <svg class="btn-icon"><use href="#icon-external"></use></svg>
                </a>
            </div>
        `;
        
        // Card Selection click logic (except links & action buttons)
        card.addEventListener('click', (e) => {
            const isClickable = e.target.closest('a') || e.target.closest('.btn-card-action');
            if (!isClickable) {
                toggleSelection(update.id);
            }
        });
        
        // Action Buttons Setup
        const btnTweet = card.querySelector('.btn-card-action.tweet');
        btnTweet.addEventListener('click', (e) => {
            e.stopPropagation();
            composeTweetFromUpdate(update);
        });
        
        const btnCopy = card.querySelector('.btn-card-action.copy');
        btnCopy.addEventListener('click', (e) => {
            e.stopPropagation();
            copyToClipboard(update.plain_text);
        });
        
        elements.notesContainer.appendChild(card);
    });
}

// Get filtered lists of updates based on category & search query
function getFilteredUpdates() {
    return state.updates.filter(u => {
        // Category check
        const matchCategory = state.activeCategory === 'all' || u.type === state.activeCategory;
        
        // Search query check
        let matchSearch = true;
        if (state.searchQuery) {
            const query = state.searchQuery.toLowerCase();
            const inText = u.plain_text.toLowerCase().includes(query);
            const inDate = u.date.toLowerCase().includes(query);
            const inType = u.type.toLowerCase().includes(query);
            matchSearch = inText || inDate || inType;
        }
        
        return matchCategory && matchSearch;
    });
}

// Search Inputs Handler
function handleSearchInput(e) {
    state.searchQuery = e.target.value.trim();
    
    if (state.searchQuery) {
        elements.searchClear.style.display = 'block';
    } else {
        elements.searchClear.style.display = 'none';
    }
    
    renderReleaseNotes();
}

function clearSearch() {
    elements.searchInput.value = '';
    state.searchQuery = '';
    elements.searchClear.style.display = 'none';
    renderReleaseNotes();
    elements.searchInput.focus();
}

// Toggle single card selection
function toggleSelection(id) {
    if (state.selectedIds.has(id)) {
        state.selectedIds.delete(id);
    } else {
        state.selectedIds.add(id);
    }
    
    // Toggle class visually
    const card = document.querySelector(`.note-card[data-id="${id}"]`);
    if (card) {
        card.classList.toggle('selected');
    }
    
    updateSelectionBar();
}

// Update selection floating bar visibility and text count
function updateSelectionBar() {
    const selectedCount = state.selectedIds.size;
    
    if (selectedCount > 0) {
        elements.selectionCountText.textContent = `${selectedCount} update${selectedCount > 1 ? 's' : ''} selected`;
        elements.selectionBar.classList.add('visible');
    } else {
        elements.selectionBar.classList.remove('visible');
    }
}

// Select all currently visible cards in the feed
function selectAllVisible() {
    const visibleUpdates = getFilteredUpdates();
    visibleUpdates.forEach(update => {
        state.selectedIds.add(update.id);
        const card = document.querySelector(`.note-card[data-id="${update.id}"]`);
        if (card) card.classList.add('selected');
    });
    updateSelectionBar();
    showToast(`Selected all ${visibleUpdates.length} visible updates!`, 'info');
}

// Clear all card selections
function clearSelection() {
    state.selectedIds.clear();
    document.querySelectorAll('.note-card').forEach(card => card.classList.remove('selected'));
    updateSelectionBar();
    showToast('Selection cleared', 'info');
}

// Clipboard copy helper
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Text copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Clipboard copy failed:', err);
        showToast('Failed to copy text.', 'error');
    });
}

// Formats tweet content for a single release note update
function formatTweetText(update) {
    const header = `BigQuery ${update.type} (${update.date}): `;
    const link = update.link;
    // URL takes approx 24 chars in Twitter intent
    const maxTextLen = 280 - header.length - 24 - 4; // 4 extra buffer
    
    let body = update.plain_text;
    if (body.length > maxTextLen) {
        body = body.substring(0, maxTextLen - 3) + '...';
    }
    
    return `${header}${body}`;
}

// Compose Tweet for a single card click
function composeTweetFromUpdate(update) {
    const defaultText = formatTweetText(update);
    openTweetModal(defaultText, update.link);
}

// Compose Tweet from bulk selections
function composeTweetFromSelection() {
    if (state.selectedIds.size === 0) return;
    
    // Find all selected updates
    const selectedUpdates = state.updates.filter(u => state.selectedIds.has(u.id));
    
    let defaultText = '';
    let commonLink = 'https://docs.cloud.google.com/bigquery/docs/release-notes';
    
    if (selectedUpdates.length === 1) {
        defaultText = formatTweetText(selectedUpdates[0]);
        commonLink = selectedUpdates[0].link;
    } else {
        // Group updates by type and date
        const summaryParts = [];
        selectedUpdates.forEach((u, i) => {
            if (i < 3) {
                // Short plain text snippet
                let cleanText = u.plain_text;
                if (cleanText.length > 50) {
                    cleanText = cleanText.substring(0, 47) + '...';
                }
                summaryParts.push(`- ${u.type} (${u.date}): ${cleanText}`);
            }
        });
        
        if (selectedUpdates.length > 3) {
            summaryParts.push(`- Plus ${selectedUpdates.length - 3} more updates...`);
        }
        
        const header = `Check out the latest Google BigQuery Release Notes:\n`;
        const body = summaryParts.join('\n');
        
        // Truncate whole thing if too long
        const fullDraft = `${header}${body}`;
        const maxTextLen = 280 - 24 - 4;
        
        if (fullDraft.length > maxTextLen) {
            defaultText = fullDraft.substring(0, maxTextLen - 3) + '...';
        } else {
            defaultText = fullDraft;
        }
    }
    
    openTweetModal(defaultText, commonLink);
}

// Opens the Tweet Composer dialog
let currentTweetLink = '';
function openTweetModal(text, url) {
    currentTweetLink = url;
    elements.tweetTextarea.value = text;
    
    if (url) {
        elements.tweetLinkCard.style.display = 'block';
        elements.tweetLinkCard.querySelector('.link-card-domain').textContent = new URL(url).hostname;
    } else {
        elements.tweetLinkCard.style.display = 'none';
    }
    
    elements.tweetModal.classList.add('visible');
    elements.tweetModal.style.display = 'flex';
    
    updateTweetPreview();
    
    // Lock body scroll
    document.body.style.overflow = 'hidden';
}

// Closes the Tweet Composer dialog
function closeTweetModal() {
    elements.tweetModal.classList.remove('visible');
    setTimeout(() => {
        elements.tweetModal.style.display = 'none';
    }, 300);
    
    // Unlock body scroll
    document.body.style.overflow = '';
}

// Live update counter and mock tweet layout
function updateTweetPreview() {
    const text = elements.tweetTextarea.value;
    
    // Render text in preview
    elements.tweetPreviewText.textContent = text;
    
    // Calculate total character count
    // Twitter counts links as 23 characters
    const urlLength = currentTweetLink ? 23 : 0;
    const baseTextLength = text.length;
    const totalLength = baseTextLength + (currentTweetLink ? (text.length > 0 ? 1 : 0) + urlLength : 0); // Include space if text is present
    
    elements.charCounter.textContent = `${totalLength} / 280`;
    
    // Character Limit Colors
    elements.charCounter.className = 'char-counter';
    elements.btnPublishTweet.disabled = false;
    
    if (totalLength > 260 && totalLength <= 280) {
        elements.charCounter.classList.add('warning');
    } else if (totalLength > 280) {
        elements.charCounter.classList.add('error');
        elements.btnPublishTweet.disabled = true; // Disable button if limits exceeded
    }
}

// Opens Twitter intent composer in a new tab
function publishTweet() {
    const text = elements.tweetTextarea.value;
    let url = currentTweetLink || '';
    
    let twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    if (url) {
        twitterIntentUrl += `&url=${encodeURIComponent(url)}`;
    }
    
    window.open(twitterIntentUrl, '_blank', 'noopener,noreferrer');
    
    // Close modal and show Success Toast
    closeTweetModal();
    showToast('Redirected to X / Twitter composer!', 'success');
}

// Toast alerts helper
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Select Icon Symbol
    let iconSymbol = 'icon-check';
    if (type === 'error') iconSymbol = 'icon-close';
    if (type === 'info') iconSymbol = 'icon-search';
    
    toast.innerHTML = `
        <svg class="toast-icon"><use href="#${iconSymbol}"></use></svg>
        <span class="toast-message">${message}</span>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    // Auto dismiss after 4 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 4000);
}
