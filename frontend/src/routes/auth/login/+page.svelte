<script lang="ts">
  import { goto } from "$app/navigation";
  import { auth, authActions } from "$lib/stores/auth";
  import { toastStore } from "$lib/stores/toast";
  import { onMount } from "svelte";

  let email = "";
  let password = "";
  let loading = false;
  let error = "";

  // Redirect if already authenticated
  onMount(() => {
    if ($auth.initialized && $auth.user) {
      goto("/dashboard");
    }
  });

  // Reactive redirect when auth state changes
  $: if ($auth.initialized && $auth.user) {
    goto("/dashboard");
  }

  async function handleLogin() {
    if (!email || !password) {
      error = "Please fill in all fields";
      return;
    }

    loading = true;
    error = "";

    const result = await authActions.login({ email, password });

    if (result.success) {
      toastStore.push("Welcome back!", { type: "success" });
      // Redirect will happen automatically via reactive statement
    } else {
      error = result.error || "Login failed";
    }

    loading = false;
  }
</script>

<svelte:head>
  <title>Sign In - ProofSkill AI</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center py-12 px-4">
  <div class="w-full max-w-md">
    <!-- Header -->
    <div class="text-center mb-8">
      <div class="flex items-center justify-center space-x-2 mb-6">
        <div
          class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground"
        >
          <svg class="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M12 2L2 7v10c0 5.55 3.84 9.74 9 11 5.16-1.26 9-5.45 9-11V7l-10-5z"
            />
          </svg>
        </div>
        <span class="text-2xl font-bold"
          >ProofSkill<span class="text-brand">AI</span></span
        >
      </div>
      <h1 class="text-2xl font-bold text-foreground">Welcome back</h1>
      <p class="text-muted-foreground mt-2">
        Sign in to your account to continue
      </p>
    </div>

    <!-- Login Form -->
    <div class="card p-8">
      <form on:submit|preventDefault={handleLogin} class="space-y-6">
        {#if error}
          <div
            class="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm"
          >
            {error}
          </div>
        {/if}

        <div class="space-y-2">
          <label for="email" class="block text-sm font-medium text-foreground">
            Email address
          </label>
          <input
            id="email"
            type="email"
            bind:value={email}
            placeholder="Enter your email"
            class="input"
            required
            disabled={loading}
          />
        </div>

        <div class="space-y-2">
          <label
            for="password"
            class="block text-sm font-medium text-foreground"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            bind:value={password}
            placeholder="Enter your password"
            class="input"
            required
            disabled={loading}
          />
        </div>

        <div class="flex items-center justify-between">
          <label class="flex items-center space-x-2 text-sm">
            <input type="checkbox" class="rounded border-input-border" />
            <span class="text-muted-foreground">Remember me</span>
          </label>
          <a
            href="/auth/forgot-password"
            class="text-sm text-brand hover:underline"
          >
            Forgot password?
          </a>
        </div>

        <button type="submit" class="btn btn-primary w-full" disabled={loading}>
          {#if loading}
            <div class="spinner h-4 w-4"></div>
            Signing in...
          {:else}
            Sign in
          {/if}
        </button>
      </form>

      <div class="mt-6 text-center">
        <p class="text-sm text-muted-foreground">
          Don't have an account?
          <a
            href="/auth/register"
            class="text-brand hover:underline font-medium"
          >
            Sign up
          </a>
        </p>
      </div>
    </div>

    <!-- Footer Links -->
    <div class="mt-8 text-center">
      <div class="flex justify-center space-x-4 text-xs text-muted-foreground">
        <a href="/privacy" class="hover:text-foreground">Privacy Policy</a>
        <a href="/terms" class="hover:text-foreground">Terms of Service</a>
        <a href="/support" class="hover:text-foreground">Support</a>
      </div>
    </div>
  </div>
</div>
