document.addEventListener('DOMContentLoaded', () => {
    const ticketForm = document.getElementById('ticket-form');
    const ticketsContainer = document.getElementById('tickets-container');
    const ticketStatsDiv = document.getElementById('ticket-stats');
    const unclaimedTicketsContainer = document.getElementById('unclaimed-tickets-container');
    const statusFilter = document.getElementById('status-filter');
    const searchInput = document.getElementById('search-input');
    const myClaimsCheckbox = document.getElementById('my-claims');
    const clearTicketsBtn = document.getElementById('clear-tickets-btn');
    const hrStaffSelect = document.getElementById('hr-staff-select');
    const reportsDropdown = document.getElementById('reports-dropdown');
    const loadingSpinner = document.getElementById('loading-spinner');
    const paginationControls = document.getElementById('pagination-controls');
    const refreshBtn = document.getElementById('refresh-btn');

    // Elements for the index.html page
    const myNameInput = document.getElementById('my-name');
    const viewTicketsBtn = document.getElementById('view-tickets-btn');
    const myTicketsList = document.getElementById('my-tickets-list');

    let currentHrStaff = [];
    let ticketChart = null;
    let departmentChart = null;
    let currentPage = 1;
    const pageSize = 9;

    function showSpinner() {
        if (loadingSpinner) {
            loadingSpinner.style.display = 'flex';
        }
    }

    function hideSpinner() {
        if (loadingSpinner) {
            loadingSpinner.style.display = 'none';
        }
    }

    function showToast(message, type = 'success') {
        Toastify({
            text: message,
            duration: 3000,
            close: true,
            gravity: "top",
            position: "right",
            backgroundColor: type === 'success' ? "#27ae60" : "#e74c3c",
            stopOnFocus: true,
            className: "toast"
        }).showToast();
    }

    async function fetchHrStaff() {
        try {
            const response = await fetch('/api/hr_staff');
            if (!response.ok) {
                throw new Error('Failed to fetch HR staff');
            }
            currentHrStaff = await response.json();
            const staffSelects = document.querySelectorAll('.staff-select');
            staffSelects.forEach(select => {
                select.innerHTML = '<option value="">Unassigned</option>';
                currentHrStaff.forEach(staff => {
                    const option = document.createElement('option');
                    option.value = staff;
                    option.textContent = staff;
                    select.appendChild(option);
                });
            });
        } catch (error) {
            console.error('Error fetching HR staff:', error);
            showToast('Failed to load HR staff', 'error');
        }
    }

    if (ticketForm) {
        ticketForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('name').value;
            const department = document.getElementById('department').value;
            const issue_type = document.getElementById('issue_type').value;
            const priority = document.getElementById('priority').value;
            const description = document.getElementById('description').value;

            const formData = { name, department, issue_type, priority, description };
            
            if (!name || !department || !issue_type || !priority || !description) {
                showToast('Please fill in all fields', 'error');
                return;
            }
            showSpinner();
            try {
                const response = await fetch('/api/tickets', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formData)
                });

                const result = await response.json();
                if (response.ok) {
                    showToast('Ticket submitted successfully!');
                    ticketForm.reset();
                } else {
                    showToast(result.error || 'Failed to submit ticket', 'error');
                }
            } catch (error) {
                console.error('Error submitting ticket:', error);
                showToast('Failed to connect to the server', 'error');
            } finally {
                hideSpinner();
            }
        });
    }

    async function fetchAndRenderTickets() {
        if (!ticketsContainer) return;
        showSpinner();
        try {
            const status = statusFilter.value;
            const search = searchInput.value;
            const myClaims = myClaimsCheckbox.checked;

            const url = `/api/tickets?status=${status}&search=${encodeURIComponent(search)}&my_claims=${myClaims}&page=${currentPage}&page_size=${pageSize}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.error) {
                ticketsContainer.innerHTML = `<p class="no-tickets-message">Failed to load tickets: ${data.error}</p>`;
                renderPaginationControls(0, 0);
                return;
            }

            ticketsContainer.innerHTML = '';
            if (data.tickets.length === 0) {
                ticketsContainer.innerHTML = '<p class="no-tickets-message">No tickets found.</p>';
            } else {
                data.tickets.forEach(ticket => {
                    const ticketElement = createTicketCard(ticket, false);
                    ticketsContainer.appendChild(ticketElement);
                });
            }
            renderPaginationControls(data.total_pages, data.current_page);
        } catch (error) {
            console.error('Error fetching tickets:', error);
            ticketsContainer.innerHTML = `<p class="no-tickets-message">Failed to load tickets: ${error.message}</p>`;
            renderPaginationControls(0, 0);
        } finally {
            hideSpinner();
        }
    }

    function renderPaginationControls(totalPages, currentPage) {
        if (!paginationControls) return;
        paginationControls.innerHTML = '';
        if (totalPages <= 1) return;

        const prevButton = document.createElement('button');
        prevButton.textContent = 'Previous';
        prevButton.className = 'btn btn-secondary';
        prevButton.disabled = currentPage === 1;
        prevButton.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                fetchAndRenderTickets();
            }
        });
        paginationControls.appendChild(prevButton);

        for (let i = 1; i <= totalPages; i++) {
            const pageButton = document.createElement('button');
            pageButton.textContent = i;
            pageButton.className = `btn ${i === currentPage ? 'btn-primary' : 'btn-secondary'}`;
            pageButton.addEventListener('click', () => {
                currentPage = i;
                fetchAndRenderTickets();
            });
            paginationControls.appendChild(pageButton);
        }

        const nextButton = document.createElement('button');
        nextButton.textContent = 'Next';
        nextButton.className = 'btn btn-secondary';
        nextButton.disabled = currentPage === totalPages;
        nextButton.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                fetchAndRenderTickets();
            }
        });
        paginationControls.appendChild(nextButton);
    }

    async function fetchAndRenderUnclaimedTickets() {
        if (!unclaimedTicketsContainer) return;
        const unclaimedSpinner = document.getElementById('unclaimed-spinner');
        unclaimedSpinner.style.display = 'flex';
        unclaimedTicketsContainer.innerHTML = '';
        try {
            const response = await fetch('/api/unclaimed_tickets');
            const tickets = await response.json();
            
            if (tickets.error) {
                unclaimedTicketsContainer.innerHTML = `<p class="no-tickets-message">Failed to load unclaimed tickets.</p>`;
                return;
            }

            if (tickets.length === 0) {
                unclaimedTicketsContainer.innerHTML = '<p class="no-tickets-message">No unclaimed tickets.</p>';
            } else {
                tickets.forEach(ticket => {
                    const ticketElement = createTicketCard(ticket, true, true);
                    unclaimedTicketsContainer.appendChild(ticketElement);
                });
            }
        } catch (error) {
            console.error('Error fetching unclaimed tickets:', error);
            unclaimedTicketsContainer.innerHTML = `<p class="no-tickets-message">Failed to load unclaimed tickets.</p>`;
        } finally {
            unclaimedSpinner.style.display = 'none';
        }
    }

    if (viewTicketsBtn) {
        viewTicketsBtn.addEventListener('click', async () => {
            const name = myNameInput.value.trim();
            if (!name) {
                showToast('Please enter your name', 'error');
                return;
            }
            myTicketsList.innerHTML = '';
            showSpinner();
            try {
                const response = await fetch(`/api/my_tickets?name=${encodeURIComponent(name)}`);
                const tickets = await response.json();

                if (tickets.error) {
                    myTicketsList.innerHTML = `<p class="no-tickets-message">Failed to load your tickets: ${tickets.error}</p>`;
                    return;
                }

                if (tickets.length === 0) {
                    myTicketsList.innerHTML = '<p class="no-tickets-message">No tickets found for this name.</p>';
                } else {
                    tickets.forEach(ticket => {
                        const ticketItem = document.createElement('li');
                        ticketItem.className = 'my-ticket-item';
                        ticketItem.innerHTML = `
                            <h4>Ticket #${ticket.id} - ${ticket.issue_type}</h4>
                            <p>Status: <span class="status-${ticket.status.replace(' ', '')}">${ticket.status}</span></p>
                            <p>Created: ${ticket.created_at}</p>
                            <p>Description: ${ticket.description}</p>
                            ${ticket.resolution_note ? `<p>Resolution: ${ticket.resolution_note}</p>` : ''}
                        `;
                        myTicketsList.appendChild(ticketItem);
                    });
                }
            } catch (error) {
                console.error('Error fetching my tickets:', error);
                myTicketsList.innerHTML = `<p class="no-tickets-message">Failed to load your tickets.</p>`;
            } finally {
                hideSpinner();
            }
        });
    }

    function createTicketCard(ticket, isUnclaimed = false, isSidebar = false) {
        const card = document.createElement('div');
        card.className = `ticket-card status-${ticket.status.replace(' ', '')} priority-${ticket.priority} ${isUnclaimed ? 'unclaimed-card' : ''}`;

        let content = `
            <div class="ticket-badges">
                <span class="status-badge">${ticket.status}</span>
                <span class="priority-badge">${ticket.priority}</span>
            </div>
            <div class="ticket-header">
                <h3>Ticket #${ticket.id} - ${ticket.issue_type}</h3>
                <p class="ticket-subtitle">Submitted by ${ticket.name} - ${ticket.department}</p>
            </div>
            <p class="ticket-date">Created: ${ticket.created_at}</p>
            <div class="ticket-content">
                <p>${ticket.description}</p>
            </div>
            <div class="ticket-details">
                <span>Assigned to: ${ticket.assigned_to || 'Unassigned'}</span>
            </div>
        `;

        if (ticket.sla_deadline && new Date(ticket.sla_deadline) < new Date() && ticket.status !== 'Resolved') {
            content += `<span class="sla-breach">SLA Breach</span>`;
        }

        if (ticket.history && ticket.history.length > 0) {
            content += `
                <div class="ticket-history">
                    <h4>History</h4>
                    <ul>
                        ${ticket.history.map(h => `<li>${h.timestamp}: ${h.action} by ${h.performed_by}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        content += `
            <div class="ticket-actions">
                <div class="staff-assignment">
                    <select class="form-select staff-select" data-ticket-id="${ticket.id}">
                        <option value="">Unassigned</option>
                        ${currentHrStaff.map(staff => `<option value="${staff}" ${ticket.assigned_to === staff ? 'selected' : ''}>${staff}</option>`).join('')}
                    </select>
                    <button class="btn btn-primary assign-btn">Assign</button>
                </div>
                <div class="status-assignment">
                    <select class="form-select status-select" data-ticket-id="${ticket.id}">
                        <option value="Open" ${ticket.status === 'Open' ? 'selected' : ''}>Open</option>
                        <option value="In Progress" ${ticket.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                        <option value="Resolved" ${ticket.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                    </select>
                    <button class="btn btn-primary update-status-btn">Update Status</button>
                </div>
                <div class="resolution-note-container">
                    <textarea class="resolution-note-input" placeholder="Resolution Note">${ticket.resolution_note || ''}</textarea>
                    <button class="btn btn-primary update-note-btn">Update Note</button>
                </div>
            </div>
        `;

        card.innerHTML = content;

        card.querySelector('.assign-btn').addEventListener('click', () => {
            const select = card.querySelector('.staff-select');
            updateTicket(ticket.id, { assigned_to: select.value });
        });

        card.querySelector('.update-status-btn').addEventListener('click', () => {
            const select = card.querySelector('.status-select');
            updateTicket(ticket.id, { status: select.value });
        });

        card.querySelector('.update-note-btn').addEventListener('click', () => {
            const textarea = card.querySelector('.resolution-note-input');
            updateTicket(ticket.id, { resolution_note: textarea.value });
        });

        return card;
    }

    async function updateTicket(ticketId, data) {
        try {
            const response = await fetch(`/api/tickets/${ticketId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (response.ok) {
                showToast(result.message || 'Ticket updated successfully');
                fetchAndRenderTickets();
                fetchAndRenderUnclaimedTickets();
                fetchAndRenderTicketStats();
                fetchAndRenderCharts();
            } else {
                showToast(result.error || 'Failed to update ticket', 'error');
            }
        } catch (error) {
            console.error('Error updating ticket:', error);
            showToast('Failed to update ticket', 'error');
        }
    }

    async function fetchAndRenderTicketStats() {
        if (!document.getElementById('total-tickets')) return;
        try {
            const response = await fetch('/api/ticket_stats');
            const stats = await response.json();
            
            if (stats.error) {
                console.error('Stats API error:', stats.error);
                showToast(stats.error, 'error');
                return;
            }
            
            console.log('Received stats:', stats);
            
            const totalElement = document.getElementById('total-tickets');
            const openElement = document.getElementById('open-tickets');
            const inProgressElement = document.getElementById('inprogress-tickets');
            const resolvedElement = document.getElementById('resolved-tickets');
            const avgTimeElement = document.getElementById('avg-resolution-time');
            const slaBreachElement = document.getElementById('sla-breaches');
            
            if (totalElement) totalElement.textContent = stats.total || 0;
            if (openElement) openElement.textContent = stats.open || 0;
            if (inProgressElement) inProgressElement.textContent = stats.in_progress || 0;
            if (resolvedElement) resolvedElement.textContent = stats.resolved || 0;
            if (avgTimeElement) avgTimeElement.textContent = stats.avg_resolution_time_hours || 'N/A';
            if (slaBreachElement) slaBreachElement.textContent = stats.sla_breaches || 0;
            
        } catch (error) {
            console.error('Error fetching ticket stats:', error);
            showToast('Failed to load dashboard statistics', 'error');
            
            const elements = [
                'total-tickets', 'open-tickets', 'inprogress-tickets', 
                'resolved-tickets', 'sla-breaches'
            ];
            elements.forEach(id => {
                const element = document.getElementById(id);
                if (element) element.textContent = '0';
            });
            
            const avgElement = document.getElementById('avg-resolution-time');
            if (avgElement) avgElement.textContent = 'N/A';
        }
    }

    async function fetchAndRenderCharts() {
        const ticketCtx = document.getElementById('ticket-chart');
        const departmentCtx = document.getElementById('department-chart');
        
        if (!ticketCtx || !departmentCtx) {
            console.log('Chart elements not found');
            return;
        }

        try {
            const response = await fetch('/api/ticket_stats');
            const stats = await response.json();
            
            if (stats.error) {
                console.error('Charts API error:', stats.error);
                showToast(stats.error, 'error');
                return;
            }
            
            console.log('Chart stats received:', stats);

            const commonChartOptions = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { 
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true,
                            font: {
                                size: 12
                            }
                        }
                    }
                }
            };
            
            const colors = [
                '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
                '#FF9966', '#C9CBCE', '#A6A6A6', '#F7464A', '#46BFBD'
            ];
            
            if (ticketChart) {
                ticketChart.destroy();
                ticketChart = null;
            }
            
            const ticketLabels = Object.keys(stats.by_issue_type || {});
            const ticketData = Object.values(stats.by_issue_type || {});
            
            if (ticketData.length > 0 && ticketData.some(val => val > 0)) {
                ticketChart = new Chart(ticketCtx, {
                    type: 'doughnut',
                    data: {
                        labels: ticketLabels,
                        datasets: [{
                            data: ticketData,
                            backgroundColor: colors.slice(0, ticketLabels.length),
                            borderWidth: 2,
                            borderColor: '#ffffff'
                        }]
                    },
                    options: commonChartOptions
                });
            } else {
                ticketCtx.getContext('2d').clearRect(0, 0, ticketCtx.width, ticketCtx.height);
                const container = ticketCtx.parentElement;
                container.innerHTML = '<p class="text-center text-muted">No ticket data available.</p>';
            }

            if (departmentChart) {
                departmentChart.destroy();
                departmentChart = null;
            }

            const departmentLabels = Object.keys(stats.by_department || {});
            const departmentData = Object.values(stats.by_department || {});
            
            if (departmentData.length > 0 && departmentData.some(val => val > 0)) {
                departmentChart = new Chart(departmentCtx, {
                    type: 'doughnut',
                    data: {
                        labels: departmentLabels,
                        datasets: [{
                            data: departmentData,
                            backgroundColor: colors.slice(0, departmentLabels.length),
                            borderWidth: 2,
                            borderColor: '#ffffff'
                        }]
                    },
                    options: commonChartOptions
                });
            } else {
                departmentCtx.getContext('2d').clearRect(0, 0, departmentCtx.width, departmentCtx.height);
                const container = departmentCtx.parentElement;
                container.innerHTML = '<p class="text-center text-muted">No department data available.</p>';
            }

        } catch (error) {
            console.error('Error fetching or rendering chart data:', error);
            showToast('Failed to load chart data', 'error');
        }
    }

    if (reportsDropdown) {
        reportsDropdown.addEventListener('change', async (e) => {
            const reportType = e.target.value;
            if (!reportType) return;
            showSpinner();
            try {
                const response = await fetch(`/api/reports/${reportType}`);
                if (!response.ok) {
                    throw new Error('Failed to generate report');
                }
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `HR_Report_${new Date().toISOString().slice(0, 10)}.${reportType}`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                showToast('Report generated successfully!');
            } catch (error) {
                console.error('Error generating report:', error);
                showToast('Failed to generate report', 'error');
            } finally {
                hideSpinner();
            }
        });
    }

    if (clearTicketsBtn) {
        clearTicketsBtn.addEventListener('click', async () => {
            if (!confirm('Are you sure you want to clear all tickets? This action cannot be undone.')) {
                return;
            }
            showSpinner();
            try {
                const response = await fetch('/api/tickets/clear', { method: 'DELETE' });
                const result = await response.json();
                if (response.ok) {
                    showToast(result.message);
                    fetchAndRenderTickets();
                    fetchAndRenderUnclaimedTickets();
                    fetchAndRenderTicketStats();
                    fetchAndRenderCharts();
                } else {
                    showToast(result.error || 'Failed to clear tickets', 'error');
                }
            } catch (error) {
                console.error('Error clearing tickets:', error);
                showToast('Failed to clear tickets', 'error');
            } finally {
                hideSpinner();
            }
        });
    }

    // Add event listeners for filter controls
    if (statusFilter) {
        statusFilter.addEventListener('change', () => {
            currentPage = 1; // Reset to first page on filter change
            fetchAndRenderTickets();
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            currentPage = 1; // Reset to first page on search
            fetchAndRenderTickets();
        });
    }

    if (myClaimsCheckbox) {
        myClaimsCheckbox.addEventListener('change', () => {
            currentPage = 1; // Reset to first page on checkbox change
            fetchAndRenderTickets();
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', (e) => {
            e.preventDefault();
            currentPage = 1;
            fetchAndRenderTickets();
            fetchAndRenderUnclaimedTickets();
            fetchAndRenderTicketStats();
            fetchAndRenderCharts();
            showToast('Dashboard refreshed');
        });
    }

    if (document.querySelector('.hr-page')) {
        console.log('Initializing HR dashboard...');
        fetchHrStaff().then(() => console.log('HR staff loaded'));
        fetchAndRenderTickets().then(() => console.log('Tickets loaded'));
        fetchAndRenderUnclaimedTickets().then(() => console.log('Unclaimed tickets loaded'));
        fetchAndRenderTicketStats().then(() => console.log('Ticket stats loaded'));
        fetchAndRenderCharts().then(() => console.log('Charts loaded'));
        
        setInterval(() => {
            fetchAndRenderTicketStats();
            fetchAndRenderCharts();
        }, 30000);
    }
});