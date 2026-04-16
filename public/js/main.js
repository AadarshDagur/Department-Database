// Department Database - Main JS

document.addEventListener('DOMContentLoaded', function () {

  // Auto-dismiss flash messages after 5 seconds
  const alerts = document.querySelectorAll('.flash-container .alert');
  alerts.forEach(function (alert) {
    setTimeout(function () {
      const bsAlert = bootstrap.Alert.getOrCreateInstance(alert);
      bsAlert.close();
    }, 5000);
  });

  // Initialize Bootstrap tooltips
  const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
  tooltipTriggerList.forEach(el => new bootstrap.Tooltip(el));

  // Sidebar toggle for mobile
  const toggler = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  if (toggler && sidebar) {
    toggler.addEventListener('click', function () {
      sidebar.classList.toggle('show');
    });
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', function (e) {
      if (window.innerWidth < 992 && sidebar.classList.contains('show') &&
          !sidebar.contains(e.target) && e.target !== toggler && !toggler.contains(e.target)) {
        sidebar.classList.remove('show');
      }
    });
  }

  // Sidebar scroll position persistence
  if (sidebar) {
    const savedScroll = sessionStorage.getItem('sidebarScroll');
    if (savedScroll) {
      sidebar.scrollTop = parseInt(savedScroll, 10);
    }
    sidebar.addEventListener('scroll', function () {
      sessionStorage.setItem('sidebarScroll', sidebar.scrollTop);
    });
  }

  // CSV Upload - Drag & Drop
  const dropZone = document.getElementById('csvDropZone');
  const fileInput = document.getElementById('csvFileInput');
  const fileName = document.getElementById('csvFileName');

  if (dropZone && fileInput) {
    ['dragenter', 'dragover'].forEach(evt => {
      dropZone.addEventListener(evt, function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(evt => {
      dropZone.addEventListener(evt, function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
      });
    });

    dropZone.addEventListener('drop', function (e) {
      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].name.endsWith('.csv')) {
        fileInput.files = files;
        showFileName(files[0].name);
      }
    });

    dropZone.addEventListener('click', function (e) {
      if (e.target.tagName !== 'BUTTON' && !e.target.closest('button')) {
        fileInput.click();
      }
    });

    fileInput.addEventListener('change', function () {
      if (fileInput.files.length > 0) {
        showFileName(fileInput.files[0].name);
      }
    });

    function showFileName(name) {
      if (fileName) {
        fileName.textContent = '\u2714 ' + name;
        fileName.classList.remove('d-none');
      }
    }
  }

  // CSV upload form submission loading state
  const csvForm = document.getElementById('csvUploadForm');
  const csvBtn = document.getElementById('csvUploadBtn');
  if (csvForm && csvBtn) {
    csvForm.addEventListener('submit', function () {
      csvBtn.disabled = true;
      csvBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Importing...';
    });
  }

  // Client-side filter for multi-select inputs like publication authors
  const filterInputs = document.querySelectorAll('[data-filter-target]');
  filterInputs.forEach(function (input) {
    const select = document.getElementById(input.dataset.filterTarget);
    if (!select) return;

    const options = Array.from(select.options);

    input.addEventListener('input', function () {
      const query = input.value.trim().toLowerCase();

      options.forEach(function (option) {
        const matches = !query || option.text.toLowerCase().includes(query);
        option.hidden = !matches;
      });

      const firstVisibleOption = options.find(option => !option.hidden);
      if (firstVisibleOption) {
        firstVisibleOption.scrollIntoView({ block: 'nearest' });
      }
    });
  });

  // Client-side list filtering on index pages without page refresh
  const filterSearchInputs = document.querySelectorAll('form[method="GET"] input[name="search"]');
  filterSearchInputs.forEach(function (input) {
    const form = input.closest('form');
    if (!form) return;

    const tableBody = document.querySelector('.table tbody');
    const tableRows = tableBody
      ? Array.from(tableBody.querySelectorAll('tr')).filter(function (row) {
          return !row.querySelector('[colspan]');
        })
      : [];
    const cardItems = Array.from(document.querySelectorAll('.row.g-4 > [class*="col-"]'));
    const items = tableRows.length > 0 ? tableRows : cardItems;
    if (items.length === 0) return;

    const selectFilters = Array.from(form.querySelectorAll('select'));

    const applyFilters = function () {
      const searchQuery = input.value.trim().toLowerCase();
      let visibleCount = 0;

      items.forEach(function (item) {
        const itemText = item.textContent.toLowerCase();
        const matchesSearch = !searchQuery || itemText.includes(searchQuery);
        const matchesSelects = selectFilters.every(function (select) {
          const selectedValue = select.value.trim().toLowerCase();
          return !selectedValue || itemText.includes(selectedValue);
        });

        const isVisible = matchesSearch && matchesSelects;
        item.style.display = isVisible ? '' : 'none';
        if (isVisible) {
          visibleCount++;
        }
      });

      if (tableBody) {
        let emptyRow = tableBody.querySelector('.js-live-filter-empty');
        if (visibleCount === 0) {
          if (!emptyRow) {
            emptyRow = document.createElement('tr');
            emptyRow.className = 'js-live-filter-empty';
            const colspan = tableBody.closest('table')?.querySelectorAll('thead th').length || 1;
            emptyRow.innerHTML = '<td colspan="' + colspan + '" class="text-center py-4 text-muted">No matching results</td>';
            tableBody.appendChild(emptyRow);
          }
        } else if (emptyRow) {
          emptyRow.remove();
        }
      } else {
        let emptyState = document.querySelector('.js-live-filter-empty-card');
        const cardContainer = document.querySelector('.row.g-4');
        if (visibleCount === 0 && cardContainer) {
          if (!emptyState) {
            emptyState = document.createElement('div');
            emptyState.className = 'col-12 js-live-filter-empty-card';
            emptyState.innerHTML = '<p class="text-center text-muted py-4 mb-0">No matching results</p>';
            cardContainer.appendChild(emptyState);
          }
        } else if (emptyState) {
          emptyState.remove();
        }
      }
    };

    input.addEventListener('input', function () {
      applyFilters();
    });

    const selects = form.querySelectorAll('select');
    selects.forEach(function (select) {
      select.addEventListener('change', applyFilters);
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      applyFilters();
    });

    applyFilters();
  });
});
