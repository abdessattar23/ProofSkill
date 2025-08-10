<script lang="ts">
  import { onMount } from "svelte";
  import { apiClient } from "$lib/api/client";
  import { authStore } from "$lib/stores/auth";
  import { toast } from "$lib/stores/toast";

  interface Application {
    id: string;
    status: "pending" | "reviewed" | "accepted" | "rejected";
    applied_at: string;
    jobs: {
      id: string;
      title: string;
      description: string;
      region: string;
      created_at: string;
    };
  }

  let applications: Application[] = [];
  let loading = true;
  let currentPage = 1;
  let totalPages = 1;
  let selectedStatus = "";

  const statusColors = {
    pending: "bg-yellow-100 text-yellow-800",
    reviewed: "bg-blue-100 text-blue-800",
    accepted: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
  };

  const statusLabels = {
    pending: "Pending Review",
    reviewed: "Under Review",
    accepted: "Accepted",
    rejected: "Rejected",
  };

  async function loadApplications() {
    loading = true;
    try {
      const response = await apiClient.getMyApplications({
        page: currentPage,
        pageSize: 10,
        ...(selectedStatus && { status: selectedStatus }),
      });

      if (response.success && response.data) {
        applications = response.data.applications || [];
        totalPages = Math.ceil(
          (response.data.total || applications.length) / 10
        );
      } else {
        toast.add("Failed to load applications", "error");
      }
    } catch (error) {
      console.error("Error loading applications:", error);
      toast.add("Error loading applications", "error");
    } finally {
      loading = false;
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function goToPage(page: number) {
    currentPage = page;
    loadApplications();
  }

  function filterByStatus(status: string) {
    selectedStatus = status;
    currentPage = 1;
    loadApplications();
  }

  onMount(async () => {
    const user = await authStore.getUser();
    if (!user || user.role !== "candidate") {
      window.location.href = "/";
      return;
    }
    loadApplications();
  });
</script>

<svelte:head>
  <title>My Applications - ProofSkill</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900">My Job Applications</h1>
      <p class="mt-2 text-gray-600">
        Track the status of your job applications
      </p>
    </div>

    <!-- Filters -->
    <div class="mb-6">
      <div class="flex flex-wrap gap-2">
        <button
          on:click={() => filterByStatus("")}
          class="px-4 py-2 rounded-lg border {selectedStatus === ''
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}"
        >
          All Applications
        </button>
        <button
          on:click={() => filterByStatus("pending")}
          class="px-4 py-2 rounded-lg border {selectedStatus === 'pending'
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}"
        >
          Pending
        </button>
        <button
          on:click={() => filterByStatus("reviewed")}
          class="px-4 py-2 rounded-lg border {selectedStatus === 'reviewed'
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}"
        >
          Under Review
        </button>
        <button
          on:click={() => filterByStatus("accepted")}
          class="px-4 py-2 rounded-lg border {selectedStatus === 'accepted'
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}"
        >
          Accepted
        </button>
        <button
          on:click={() => filterByStatus("rejected")}
          class="px-4 py-2 rounded-lg border {selectedStatus === 'rejected'
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}"
        >
          Rejected
        </button>
      </div>
    </div>

    <!-- Applications List -->
    {#if loading}
      <div class="flex justify-center items-center py-12">
        <div
          class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
        ></div>
        <span class="ml-2 text-gray-600">Loading applications...</span>
      </div>
    {:else if applications.length === 0}
      <div class="text-center py-12">
        <div class="mx-auto h-12 w-12 text-gray-400">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            ></path>
          </svg>
        </div>
        <h3 class="mt-2 text-sm font-medium text-gray-900">
          No applications found
        </h3>
        <p class="mt-1 text-sm text-gray-500">
          {selectedStatus
            ? `No ${selectedStatus} applications found.`
            : "You haven't applied to any jobs yet."}
        </p>
        {#if !selectedStatus}
          <div class="mt-6">
            <a
              href="/jobs"
              class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Browse Jobs
            </a>
          </div>
        {/if}
      </div>
    {:else}
      <div class="space-y-4">
        {#each applications as application}
          <div
            class="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center gap-3 mb-2">
                  <h3 class="text-lg font-semibold text-gray-900">
                    <a
                      href="/jobs/{application.jobs.id}"
                      class="hover:text-blue-600"
                    >
                      {application.jobs.title}
                    </a>
                  </h3>
                  <span
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {statusColors[
                      application.status
                    ]}"
                  >
                    {statusLabels[application.status]}
                  </span>
                </div>

                <p class="text-gray-600 mb-3 line-clamp-2">
                  {application.jobs.description}
                </p>

                <div class="flex items-center gap-4 text-sm text-gray-500">
                  {#if application.jobs.region}
                    <span class="flex items-center gap-1">
                      <svg
                        class="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        ></path>
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        ></path>
                      </svg>
                      {application.jobs.region}
                    </span>
                  {/if}
                  <span class="flex items-center gap-1">
                    <svg
                      class="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M8 7V3a1 1 0 012 0v4h4a1 1 0 110 2H10v4a1 1 0 11-2 0V9H4a1 1 0 110-2h4z"
                      ></path>
                    </svg>
                    Applied {formatDate(application.applied_at)}
                  </span>
                </div>
              </div>

              <div class="ml-4">
                <a
                  href="/jobs/{application.jobs.id}"
                  class="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  View Job
                </a>
              </div>
            </div>
          </div>
        {/each}
      </div>

      <!-- Pagination -->
      {#if totalPages > 1}
        <div class="flex justify-center mt-8">
          <nav class="flex items-center gap-2">
            <button
              on:click={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              class="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            {#each Array(totalPages) as _, i}
              <button
                on:click={() => goToPage(i + 1)}
                class="px-3 py-2 text-sm font-medium rounded-md {currentPage ===
                i + 1
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'}"
              >
                {i + 1}
              </button>
            {/each}

            <button
              on:click={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              class="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </nav>
        </div>
      {/if}
    {/if}
  </div>
</div>
