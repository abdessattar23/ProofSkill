<script lang="ts">
  import { auth } from "$lib/stores/auth";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { browser } from "$app/environment";

  let mounted = false;

  onMount(() => {
    mounted = true;
  });

  // Check if user should be redirected to login
  $: if (mounted && $auth.initialized && !$auth.user && !$auth.token) {
    goto("/auth/login");
  }

  // Check if first-time candidate needs to complete mandatory profile setup
  $: if (
    mounted &&
    $auth.user &&
    $auth.user.role === "candidate" &&
    $auth.user.first_time
  ) {
    goto("/onboarding/mandatory-profile");
  }

  $: userRole = $auth.user?.role || "candidate";
</script>

<svelte:head>
  <title>Dashboard - ProofSkill AI</title>
</svelte:head>

{#if !mounted || ($auth.loading && !$auth.user)}
  <div class="flex items-center justify-center py-20">
    <div class="flex flex-col items-center space-y-4">
      <div class="spinner h-8 w-8"></div>
      <p class="text-sm text-muted-foreground">Loading dashboard...</p>
    </div>
  </div>
{:else if $auth.user}
  <div class="space-y-8">
    <!-- Welcome Header -->
    <div class="text-center py-12">
      <h1 class="text-4xl font-bold mb-4">
        Welcome back, <span class="text-brand">{$auth.user.name}</span>
      </h1>
      <p class="text-lg text-muted-foreground">
        {userRole === "candidate"
          ? "Ready to showcase your skills and advance your career?"
          : "Ready to find your next great hire?"}
      </p>
    </div>

    {#if userRole === "candidate"}
      <!-- Candidate Dashboard -->
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- Start Assessment -->
        <div class="card p-6 hover:shadow-lg transition-shadow">
          <div class="flex items-center space-x-3 mb-4">
            <div class="p-2 bg-primary/10 rounded-lg">
              <svg
                class="h-6 w-6 text-brand"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 class="text-lg font-semibold">Start Assessment</h3>
          </div>
          <p class="text-muted-foreground mb-4">
            Begin your AI-powered skill evaluation and get verified results.
          </p>
          <a href="/assessment/start" class="btn btn-primary w-full">
            Start Now
          </a>
        </div>

        <!-- Voice Interview -->
        <div class="card p-6 hover:shadow-lg transition-shadow">
          <div class="flex items-center space-x-3 mb-4">
            <div class="p-2 bg-primary/10 rounded-lg">
              <svg
                class="h-6 w-6 text-brand"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"
                />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </div>
            <h3 class="text-lg font-semibold">Voice Interview</h3>
          </div>
          <p class="text-muted-foreground mb-4">
            Practice with AI-powered voice interviews and improve your skills.
          </p>
          <a href="/interview/voice" class="btn btn-outline w-full">
            Practice Now
          </a>
        </div>

        <!-- View Results -->
        <div class="card p-6 hover:shadow-lg transition-shadow">
          <div class="flex items-center space-x-3 mb-4">
            <div class="p-2 bg-primary/10 rounded-lg">
              <svg
                class="h-6 w-6 text-brand"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M3 3v18h18" />
                <path d="m19 9-5 5-4-4-3 3" />
              </svg>
            </div>
            <h3 class="text-lg font-semibold">Assessment Results</h3>
          </div>
          <p class="text-muted-foreground mb-4">
            Review your completed assessments and performance analytics.
          </p>
          <a href="/results" class="btn btn-outline w-full"> View Results </a>
        </div>

        <!-- Job Matches -->
        <div class="card p-6 hover:shadow-lg transition-shadow">
          <div class="flex items-center space-x-3 mb-4">
            <div class="p-2 bg-primary/10 rounded-lg">
              <svg
                class="h-6 w-6 text-brand"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
                />
                <circle cx="12" cy="12" r="4" />
              </svg>
            </div>
            <h3 class="text-lg font-semibold">Job Matches</h3>
          </div>
          <p class="text-muted-foreground mb-4">
            Discover opportunities that match your verified skills.
          </p>
          <a href="/jobs" class="btn btn-outline w-full"> Browse Jobs </a>
        </div>

        <!-- Profile Settings -->
        <div class="card p-6 hover:shadow-lg transition-shadow">
          <div class="flex items-center space-x-3 mb-4">
            <div class="p-2 bg-primary/10 rounded-lg">
              <svg
                class="h-6 w-6 text-brand"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <h3 class="text-lg font-semibold">Profile Settings</h3>
          </div>
          <p class="text-muted-foreground mb-4">
            Manage your account settings and assessment preferences.
          </p>
          <a href="/profile" class="btn btn-outline w-full"> Manage Profile </a>
        </div>

        <!-- Upload CV -->
        <div class="card p-6 hover:shadow-lg transition-shadow">
          <div class="flex items-center space-x-3 mb-4">
            <div class="p-2 bg-primary/10 rounded-lg">
              <svg
                class="h-6 w-6 text-brand"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                />
                <polyline points="14,2 14,8 20,8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10,9 9,9 8,9" />
              </svg>
            </div>
            <h3 class="text-lg font-semibold">Update CV</h3>
          </div>
          <p class="text-muted-foreground mb-4">
            Upload a new CV to refresh your skill analysis.
          </p>
          <a href="/cv/upload" class="btn btn-outline w-full"> Upload CV </a>
        </div>
      </div>
    {:else}
      <!-- Business Dashboard -->
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- Post Job -->
        <div class="card p-6 hover:shadow-lg transition-shadow">
          <div class="flex items-center space-x-3 mb-4">
            <div class="p-2 bg-primary/10 rounded-lg">
              <svg
                class="h-6 w-6 text-brand"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </div>
            <h3 class="text-lg font-semibold">Post New Job</h3>
          </div>
          <p class="text-muted-foreground mb-4">
            Create a new job posting and start finding qualified candidates.
          </p>
          <a href="/jobs/create" class="btn btn-primary w-full"> Post Job </a>
        </div>

        <!-- Manage Jobs -->
        <div class="card p-6 hover:shadow-lg transition-shadow">
          <div class="flex items-center space-x-3 mb-4">
            <div class="p-2 bg-primary/10 rounded-lg">
              <svg
                class="h-6 w-6 text-brand"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
                />
              </svg>
            </div>
            <h3 class="text-lg font-semibold">Manage Jobs</h3>
          </div>
          <p class="text-muted-foreground mb-4">
            View and manage your active job postings and applications.
          </p>
          <a href="/jobs/manage" class="btn btn-outline w-full"> View Jobs </a>
        </div>

        <!-- Candidate Search -->
        <div class="card p-6 hover:shadow-lg transition-shadow">
          <div class="flex items-center space-x-3 mb-4">
            <div class="p-2 bg-primary/10 rounded-lg">
              <svg
                class="h-6 w-6 text-brand"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </div>
            <h3 class="text-lg font-semibold">Search Candidates</h3>
          </div>
          <p class="text-muted-foreground mb-4">
            Find and evaluate candidates with AI-verified skills.
          </p>
          <a href="/candidates/search" class="btn btn-outline w-full">
            Search Now
          </a>
        </div>

        <!-- Interview Analytics -->
        <div class="card p-6 hover:shadow-lg transition-shadow">
          <div class="flex items-center space-x-3 mb-4">
            <div class="p-2 bg-primary/10 rounded-lg">
              <svg
                class="h-6 w-6 text-brand"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M3 3v18h18" />
                <path d="m19 9-5 5-4-4-3 3" />
              </svg>
            </div>
            <h3 class="text-lg font-semibold">Interview Analytics</h3>
          </div>
          <p class="text-muted-foreground mb-4">
            Review interview results and candidate performance data.
          </p>
          <a href="/analytics" class="btn btn-outline w-full">
            View Analytics
          </a>
        </div>

        <!-- Team Management -->
        <div class="card p-6 hover:shadow-lg transition-shadow">
          <div class="flex items-center space-x-3 mb-4">
            <div class="p-2 bg-primary/10 rounded-lg">
              <svg
                class="h-6 w-6 text-brand"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h3 class="text-lg font-semibold">Team Settings</h3>
          </div>
          <p class="text-muted-foreground mb-4">
            Manage your recruitment team and account settings.
          </p>
          <a href="/team" class="btn btn-outline w-full"> Manage Team </a>
        </div>

        <!-- Company Profile -->
        <div class="card p-6 hover:shadow-lg transition-shadow">
          <div class="flex items-center space-x-3 mb-4">
            <div class="p-2 bg-primary/10 rounded-lg">
              <svg
                class="h-6 w-6 text-brand"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M3 21h18" />
                <path d="M5 21V7l8-4v18" />
                <path d="M19 21V11l-6-4" />
              </svg>
            </div>
            <h3 class="text-lg font-semibold">Company Profile</h3>
          </div>
          <p class="text-muted-foreground mb-4">
            Update your company information and hiring preferences.
          </p>
          <a href="/company/profile" class="btn btn-outline w-full">
            Edit Profile
          </a>
        </div>
      </div>
    {/if}

    <!-- Recent Activity -->
    <div class="card p-6">
      <h2 class="text-xl font-semibold mb-4">Recent Activity</h2>
      <div class="space-y-3">
        <div
          class="flex items-center justify-between p-3 bg-surface rounded-lg"
        >
          <div class="flex items-center space-x-3">
            <div class="w-2 h-2 bg-primary rounded-full"></div>
            <span class="text-sm">Account created</span>
          </div>
          <span class="text-xs text-muted-foreground">Just now</span>
        </div>
        <div class="text-center py-8 text-muted-foreground">
          <p>
            {userRole === "candidate"
              ? "No assessments completed yet."
              : "No recent hiring activity."}
          </p>
          <p class="text-sm mt-1">
            {userRole === "candidate"
              ? "Start your first assessment to see your progress here."
              : "Post your first job to start tracking activity."}
          </p>
        </div>
      </div>
    </div>
  </div>
{:else}
  <div class="text-center py-20">
    <h1 class="text-2xl font-bold mb-4">Authentication Required</h1>
    <p class="text-muted-foreground mb-6">
      Please sign in to access your dashboard.
    </p>
    <a href="/auth/login" class="btn btn-primary">Sign In</a>
  </div>
{/if}
