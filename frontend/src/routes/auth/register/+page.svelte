<script lang="ts">
  import { goto } from "$app/navigation";
  import { auth, authActions } from "$lib/stores/auth";
  import { toastStore } from "$lib/stores/toast";
  import { onMount } from "svelte";

  let name = "";
  let email = "";
  let password = "";
  let confirmPassword = "";
  let userType: "candidate" | "business" = "candidate";
  let loading = false;
  let error = "";
  let acceptTerms = false;

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

  $: passwordStrength = getPasswordStrength(password);
  $: passwordsMatch =
    password && confirmPassword && password === confirmPassword;
  $: isFormValid =
    name &&
    email &&
    password &&
    confirmPassword &&
    passwordsMatch &&
    acceptTerms &&
    passwordStrength.score >= 3;

  function getPasswordStrength(pwd: string) {
    if (!pwd) return { score: 0, text: "", color: "" };

    let score = 0;
    let feedback = [];

    if (pwd.length >= 8) score++;
    else feedback.push("8+ characters");

    if (/[a-z]/.test(pwd)) score++;
    else feedback.push("lowercase letter");

    if (/[A-Z]/.test(pwd)) score++;
    else feedback.push("uppercase letter");

    if (/[0-9]/.test(pwd)) score++;
    else feedback.push("number");

    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    else feedback.push("special character");

    const strength = {
      0: { text: "Very weak", color: "text-destructive" },
      1: { text: "Weak", color: "text-destructive" },
      2: { text: "Fair", color: "text-warning" },
      3: { text: "Good", color: "text-warning" },
      4: { text: "Strong", color: "text-success" },
      5: { text: "Very strong", color: "text-success" },
    };

    return {
      score,
      text: strength[score].text,
      color: strength[score].color,
      feedback: feedback.join(", "),
    };
  }

  async function handleRegister() {
    if (!isFormValid) {
      error = "Please fill in all required fields correctly";
      return;
    }

    loading = true;
    error = "";

    const result = await authActions.register({
      name,
      email,
      password,
      role: userType,
    });

    if (result.success) {
      toastStore.push("Account created successfully!", { type: "success" });
      // Redirect based on user type
      if (userType === "candidate") {
        goto("/onboarding/candidate");
      } else {
        goto("/onboarding/business");
      }
    } else {
      error = result.error || "Registration failed";
    }

    loading = false;
  }
</script>

<svelte:head>
  <title>Sign Up - ProofSkill AI</title>
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
      <h1 class="text-2xl font-bold text-foreground">Create your account</h1>
      <p class="text-muted-foreground mt-2">
        Start your journey with AI-powered assessments
      </p>
    </div>

    <!-- Registration Form -->
    <div class="card p-8">
      <form on:submit|preventDefault={handleRegister} class="space-y-6">
        {#if error}
          <div
            class="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm"
          >
            {error}
          </div>
        {/if}

        <div class="space-y-2">
          <label for="name" class="block text-sm font-medium text-foreground">
            Full name
          </label>
          <input
            id="name"
            type="text"
            bind:value={name}
            placeholder="Enter your full name"
            class="input"
            required
            disabled={loading}
          />
        </div>

        <div class="space-y-2">
          <fieldset class="space-y-3">
            <legend class="block text-sm font-medium text-foreground">
              I am signing up as a
            </legend>
            <div class="grid grid-cols-2 gap-3">
              <label class="relative cursor-pointer">
                <input
                  type="radio"
                  bind:group={userType}
                  value="candidate"
                  class="sr-only"
                  disabled={loading}
                />
                <div
                  class="card p-4 border-2 transition-all {userType ===
                  'candidate'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'}"
                >
                  <div class="flex items-center space-x-3">
                    <div
                      class="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center"
                    >
                      <svg
                        class="w-4 h-4 text-brand"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                    <div>
                      <h3 class="font-medium">Candidate</h3>
                      <p class="text-xs text-muted-foreground">
                        Looking for opportunities
                      </p>
                    </div>
                  </div>
                </div>
              </label>

              <label class="relative cursor-pointer">
                <input
                  type="radio"
                  bind:group={userType}
                  value="business"
                  class="sr-only"
                  disabled={loading}
                />
                <div
                  class="card p-4 border-2 transition-all {userType ===
                  'business'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'}"
                >
                  <div class="flex items-center space-x-3">
                    <div
                      class="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center"
                    >
                      <svg
                        class="w-4 h-4 text-brand"
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
                    <div>
                      <h3 class="font-medium">Business</h3>
                      <p class="text-xs text-muted-foreground">Hiring talent</p>
                    </div>
                  </div>
                </div>
              </label>
            </div>
          </fieldset>
        </div>

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
            placeholder="Create a strong password"
            class="input"
            required
            disabled={loading}
          />
          {#if password}
            <div class="mt-2">
              <div class="flex items-center justify-between text-xs">
                <span class={passwordStrength.color}>
                  Strength: {passwordStrength.text}
                </span>
                <span class="text-muted-foreground">
                  {passwordStrength.score}/5
                </span>
              </div>
              <div class="mt-1 flex space-x-1">
                {#each Array(5) as _, i}
                  <div
                    class="h-1 flex-1 rounded-full {i < passwordStrength.score
                      ? 'bg-current ' + passwordStrength.color
                      : 'bg-muted'}"
                  ></div>
                {/each}
              </div>
              {#if passwordStrength.feedback && passwordStrength.score < 5}
                <p class="text-xs text-muted-foreground mt-1">
                  Missing: {passwordStrength.feedback}
                </p>
              {/if}
            </div>
          {/if}
        </div>

        <div class="space-y-2">
          <label
            for="confirmPassword"
            class="block text-sm font-medium text-foreground"
          >
            Confirm password
          </label>
          <input
            id="confirmPassword"
            type="password"
            bind:value={confirmPassword}
            placeholder="Confirm your password"
            class="input {confirmPassword && !passwordsMatch
              ? 'input-error'
              : ''}"
            required
            disabled={loading}
          />
          {#if confirmPassword && !passwordsMatch}
            <p class="text-xs text-destructive">Passwords do not match</p>
          {/if}
        </div>

        <div class="flex items-start space-x-2">
          <input
            id="terms"
            type="checkbox"
            bind:checked={acceptTerms}
            class="mt-1 rounded border-input-border"
            required
            disabled={loading}
          />
          <label for="terms" class="text-sm text-muted-foreground">
            I agree to the
            <a href="/terms" class="text-brand hover:underline"
              >Terms of Service</a
            >
            and
            <a href="/privacy" class="text-brand hover:underline"
              >Privacy Policy</a
            >
          </label>
        </div>

        <button
          type="submit"
          class="btn btn-primary w-full"
          disabled={!isFormValid || loading}
        >
          {#if loading}
            <div class="spinner h-4 w-4"></div>
            Creating account...
          {:else}
            Create account
          {/if}
        </button>
      </form>

      <div class="mt-6 text-center">
        <p class="text-sm text-muted-foreground">
          Already have an account?
          <a href="/auth/login" class="text-brand hover:underline font-medium">
            Sign in
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
