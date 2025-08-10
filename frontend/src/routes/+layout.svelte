<script lang="ts">
  import "$lib/styles/globals.css";
  import Toast from "$lib/components/Toast.svelte";
  import { auth, authActions } from "$lib/stores/auth";
  import { onMount } from "svelte";

  onMount(() => {
    // Initialize auth by attempting to fetch user if token exists
    authActions.fetchMe();
  });
</script>

<svelte:head>
  <title>ProofSkill AI - Advanced Skill Assessment Platform</title>
  <meta
    name="description"
    content="AI-powered skill assessment and talent verification platform"
  />
</svelte:head>

<div class="min-h-screen bg-background">
  <!-- Professional Header -->
  <header
    class="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
  >
    <div class="container mx-auto px-4">
      <div class="flex h-16 items-center justify-between">
        <!-- Logo -->
        <div class="flex items-center space-x-2">
          <div
            class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"
          >
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 2L2 7v10c0 5.55 3.84 9.74 9 11 5.16-1.26 9-5.45 9-11V7l-10-5z"
              />
            </svg>
          </div>
          <span class="text-xl font-bold tracking-tight"
            >ProofSkill<span class="text-brand">AI</span></span
          >
        </div>

        <!-- Navigation -->
        <nav class="hidden md:flex items-center space-x-6">
          {#if $auth.user}
            <a href="/dashboard" class="nav-link">Dashboard</a>
            {#if $auth.user.role === "candidate"}
              <a href="/assessment/start" class="nav-link">Assessment</a>
              <a href="/interview/voice" class="nav-link">Interview</a>
              <a href="/jobs" class="nav-link">Jobs</a>
              <a href="/my-applications" class="nav-link">My Applications</a>
              <a href="/results" class="nav-link">Results</a>
            {:else if $auth.user.role === "business"}
              <a href="/jobs/create" class="nav-link">Post Job</a>
              <a href="/jobs/manage" class="nav-link">Manage Jobs</a>
              <a href="/candidates/search" class="nav-link">Find Candidates</a>
              <a href="/analytics" class="nav-link">Analytics</a>
            {/if}
          {:else}
            <a href="/" class="nav-link nav-link-active">Platform</a>
            <a href="/features" class="nav-link">Features</a>
            <a href="/pricing" class="nav-link">Pricing</a>
            <a href="/docs" class="nav-link">Docs</a>
          {/if}
        </nav>

        <!-- Auth Buttons -->
        <div class="flex items-center space-x-3">
          {#if $auth.user}
            <div class="relative group">
              <button
                class="flex items-center space-x-2 p-2 rounded-lg hover:bg-surface transition-colors"
              >
                <div
                  class="w-8 h-8 bg-brand rounded-full flex items-center justify-center"
                >
                  <span class="text-white text-sm font-medium">
                    {$auth.user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span class="hidden sm:block text-sm font-medium"
                  >{$auth.user.name}</span
                >
                <svg
                  class="h-4 w-4 text-muted-foreground"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <polyline points="6,9 12,15 18,9" />
                </svg>
              </button>

              <!-- Dropdown Menu -->
              <div
                class="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50"
              >
                <div class="py-2">
                  <div class="px-4 py-2 border-b border-border">
                    <p class="text-sm font-medium">{$auth.user.name}</p>
                    <p class="text-xs text-muted-foreground capitalize">
                      {$auth.user.role}
                    </p>
                  </div>
                  <a
                    href="/profile"
                    class="block px-4 py-2 text-sm hover:bg-surface transition-colors"
                  >
                    Profile Settings
                  </a>
                  {#if $auth.user.role === "business"}
                    <a
                      href="/company/profile"
                      class="block px-4 py-2 text-sm hover:bg-surface transition-colors"
                    >
                      Company Profile
                    </a>
                    <a
                      href="/team"
                      class="block px-4 py-2 text-sm hover:bg-surface transition-colors"
                    >
                      Team Settings
                    </a>
                  {:else}
                    <a
                      href="/cv/upload"
                      class="block px-4 py-2 text-sm hover:bg-surface transition-colors"
                    >
                      Update CV
                    </a>
                  {/if}
                  <div class="border-t border-border mt-2 pt-2">
                    <button
                      on:click={() => authActions.logout()}
                      class="block w-full text-left px-4 py-2 text-sm text-destructive hover:bg-surface transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>
            </div>
          {:else}
            <a href="/auth/login" class="btn btn-ghost btn-sm">Sign In</a>
            <a href="/auth/register" class="btn btn-primary btn-sm"
              >Get Started</a
            >
          {/if}
        </div>
      </div>
    </div>
  </header>

  <!-- Main Content -->
  <main class="flex-1">
    <slot />
  </main>

  <!-- Footer -->
  <footer class="border-t border-border bg-surface">
    <div class="container mx-auto px-4 py-8">
      <div class="flex flex-col md:flex-row items-center justify-between">
        <div class="flex items-center space-x-2 mb-4 md:mb-0">
          <div
            class="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 2L2 7v10c0 5.55 3.84 9.74 9 11 5.16-1.26 9-5.45 9-11V7l-10-5z"
              />
            </svg>
          </div>
          <span class="font-semibold text-foreground">ProofSkill AI</span>
        </div>
        <div class="flex items-center space-x-6 text-sm text-muted-foreground">
          <a href="/privacy" class="hover:text-foreground transition-colors"
            >Privacy</a
          >
          <a href="/terms" class="hover:text-foreground transition-colors"
            >Terms</a
          >
          <a href="/support" class="hover:text-foreground transition-colors"
            >Support</a
          >
          <span>&copy; {new Date().getFullYear()} ProofSkill AI</span>
        </div>
      </div>
    </div>
  </footer>

  <!-- Toast Notifications -->
  <Toast />
</div>
