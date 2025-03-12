/**
 * Autocomplete functionality for repository and branch dropdowns
 */

// Initialize autocomplete functionality
function initAutocomplete() {
  // Setup repository autocomplete
  setupRepoAutocomplete();
  
  // Setup branch autocomplete
  setupBranchAutocomplete();
}

// Setup repository autocomplete
function setupRepoAutocomplete() {
  // Add input field for repository search
  const repoSearchHtml = `
    <div class="repo-search-container" style="padding: 8px; border-bottom: 1px solid #e0e0e0;">
      <input type="text" id="repo-search" class="repo-search" placeholder="Search repositories..." 
        style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;">
    </div>
  `;
  $('.repo-menu').prepend(repoSearchHtml);

  // Add event listener for repository search
  $('#repo-search').on('input', function() {
    const searchTerm = $(this).val().toLowerCase();
    
    // Show all items initially
    $('.repo-menu .scm-item').show();
    
    // Hide items that don't match the search term
    if (searchTerm) {
      $('.repo-menu .scm-item').each(function() {
        const repoName = $(this).find('.vRMGwf').text().toLowerCase();
        if (repoName.indexOf(searchTerm) === -1) {
          $(this).hide();
        }
      });
    }
  });

  // Prevent dropdown from closing when clicking on the search input
  $('#repo-search').on('click', function(e) {
    e.stopPropagation();
  });

  // Handle keyboard navigation
  $('#repo-search').on('keydown', function(e) {
    const visibleItems = $('.repo-menu .scm-item:visible');
    let currentIndex = -1;
    
    // Find currently focused item
    visibleItems.each(function(index) {
      if ($(this).hasClass('KKjvXb')) {
        currentIndex = index;
        return false;
      }
    });

    switch (e.keyCode) {
      case 40: // Down arrow
        e.preventDefault();
        if (currentIndex < visibleItems.length - 1) {
          if (currentIndex >= 0) {
            $(visibleItems[currentIndex]).removeClass('KKjvXb');
          }
          $(visibleItems[currentIndex + 1]).addClass('KKjvXb');
        }
        break;
      case 38: // Up arrow
        e.preventDefault();
        if (currentIndex > 0) {
          $(visibleItems[currentIndex]).removeClass('KKjvXb');
          $(visibleItems[currentIndex - 1]).addClass('KKjvXb');
        }
        break;
      case 13: // Enter
        e.preventDefault();
        if (currentIndex >= 0) {
          $(visibleItems[currentIndex]).click();
        } else if (visibleItems.length > 0) {
          $(visibleItems[0]).click();
        }
        break;
      case 27: // Escape
        e.preventDefault();
        $('.repo-menu').hide();
        $('#repoSelect').removeClass('iWO5td');
        break;
    }
  });
}

// Setup branch autocomplete
function setupBranchAutocomplete() {
  // Add input field for branch search
  const branchSearchHtml = `
    <div class="branch-search-container" style="padding: 8px; border-bottom: 1px solid #e0e0e0;">
      <input type="text" id="branch-search" class="branch-search" placeholder="Search branches..." 
        style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;">
    </div>
  `;
  $('.branch-menu').prepend(branchSearchHtml);

  // Add event listener for branch search
  $('#branch-search').on('input', function() {
    const searchTerm = $(this).val().toLowerCase();
    
    // Show all items initially
    $('.branch-menu .scm-item').show();
    
    // Hide items that don't match the search term
    if (searchTerm) {
      $('.branch-menu .scm-item').each(function() {
        const branchName = $(this).find('.vRMGwf').text().toLowerCase();
        if (branchName.indexOf(searchTerm) === -1) {
          $(this).hide();
        }
      });
    }
  });

  // Prevent dropdown from closing when clicking on the search input
  $('#branch-search').on('click', function(e) {
    e.stopPropagation();
  });

  // Handle keyboard navigation
  $('#branch-search').on('keydown', function(e) {
    const visibleItems = $('.branch-menu .scm-item:visible');
    let currentIndex = -1;
    
    // Find currently focused item
    visibleItems.each(function(index) {
      if ($(this).hasClass('KKjvXb')) {
        currentIndex = index;
        return false;
      }
    });

    switch (e.keyCode) {
      case 40: // Down arrow
        e.preventDefault();
        if (currentIndex < visibleItems.length - 1) {
          if (currentIndex >= 0) {
            $(visibleItems[currentIndex]).removeClass('KKjvXb');
          }
          $(visibleItems[currentIndex + 1]).addClass('KKjvXb');
        }
        break;
      case 38: // Up arrow
        e.preventDefault();
        if (currentIndex > 0) {
          $(visibleItems[currentIndex]).removeClass('KKjvXb');
          $(visibleItems[currentIndex - 1]).addClass('KKjvXb');
        }
        break;
      case 13: // Enter
        e.preventDefault();
        if (currentIndex >= 0) {
          $(visibleItems[currentIndex]).click();
        } else if (visibleItems.length > 0) {
          $(visibleItems[0]).click();
        }
        break;
      case 27: // Escape
        e.preventDefault();
        $('.branch-menu').hide();
        $('#branchSelect').removeClass('iWO5td');
        break;
    }
  });
}

// Add event handlers to prevent dropdown from closing when clicking on search inputs
function addSearchInputEventHandlers() {
  // Add a custom event handler to document mouseup
  $(document).on('mouseup', function(e) {
    // If the target is a search input, stop propagation
    if ($(e.target).hasClass('repo-search') || $(e.target).hasClass('branch-search')) {
      e.stopPropagation();
    }
  });
}

// Initialize autocomplete when document is ready
$(document).ready(function() {
  // Wait for the dropdowns to be populated
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.addedNodes.length) {
        // Check if repo menu has items
        if ($('.repo-menu .scm-item').length > 0 && !$('#repo-search').length) {
          setupRepoAutocomplete();
        }
        
        // Check if branch menu has items
        if ($('.branch-menu .scm-item').length > 0 && !$('#branch-search').length) {
          setupBranchAutocomplete();
        }
      }
    });
  });
  
  // Observe changes to the repo and branch menus - safely check if elements exist first
  const repoMenu = document.querySelector('.repo-menu');
  const branchMenu = document.querySelector('.branch-menu');
  
  if (repoMenu) {
    observer.observe(repoMenu, { childList: true });
  }
  
  if (branchMenu) {
    observer.observe(branchMenu, { childList: true });
  }
  
  // If elements don't exist yet, set up a mutation observer for the body to detect when they are added
  if (!repoMenu || !branchMenu) {
    const bodyObserver = new MutationObserver(function(mutations) {
      const repoMenuNew = document.querySelector('.repo-menu');
      const branchMenuNew = document.querySelector('.branch-menu');
      
      if (repoMenuNew && !repoMenu) {
        observer.observe(repoMenuNew, { childList: true });
        if ($('.repo-menu .scm-item').length > 0 && !$('#repo-search').length) {
          setupRepoAutocomplete();
        }
      }
      
      if (branchMenuNew && !branchMenu) {
        observer.observe(branchMenuNew, { childList: true });
        if ($('.branch-menu .scm-item').length > 0 && !$('#branch-search').length) {
          setupBranchAutocomplete();
        }
      }
      
      // If both elements are found, disconnect the body observer
      if (repoMenuNew && branchMenuNew) {
        bodyObserver.disconnect();
      }
    });
    
    // Start observing the body
    bodyObserver.observe(document.body, { childList: true, subtree: true });
  }
  
  // Add event handlers for search inputs
  addSearchInputEventHandlers();
  
  // Focus search input when dropdown is opened
  $(document).on('click', '#repoSelect', function() {
    setTimeout(function() {
      if ($('.repo-menu').is(':visible')) {
        $('#repo-search').focus();
      }
    }, 100);
  });
  
  $(document).on('click', '#branchSelect', function() {
    setTimeout(function() {
      if ($('.branch-menu').is(':visible')) {
        $('#branch-search').focus();
      }
    }, 100);
  });
}); 