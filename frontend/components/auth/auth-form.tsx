"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

const DEMO_CREDENTIALS = { email: "demo@schedulr.test", password: "Password123!" };

interface AuthFormProps {
  mode: "login" | "signup";
}

type FieldErrors = Partial<Record<"fullName" | "email" | "password" | "businessName", string>>;

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const { signIn, signUp, status } = useAuth();
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isSignup = mode === "signup";

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);

  const submit = async () => {
    setFailure(null);
    setErrors({});
    setSubmitting(true);

    try {
      if (isSignup) {
        await signUp({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
          businessName: businessName.trim() || undefined,
        });
      } else {
        await signIn({ email: email.trim(), password });
      }
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors({
          fullName: error.fieldMessage("fullName"),
          businessName: error.fieldMessage("businessName"),
          email: error.fieldMessage("email"),
          password: error.fieldMessage("password"),
        });
        setFailure(error.issues.length > 0 ? "Check the highlighted fields" : error.message);
      } else {
        setFailure("Something went wrong, please try again");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-sm space-y-5">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold text-slate-900">
          {isSignup ? "Create your workspace" : "Sign in to Schedulr"}
        </h1>
        <p className="text-sm text-slate-500">
          {isSignup
            ? "Your account gets its own business, chat assistant and calendar"
            : "Book and manage appointments through the assistant"}
        </p>
      </div>

      <form
        className="space-y-3 rounded-xl bg-white p-5 ring-1 ring-slate-200"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {isSignup && (
          <>
            <Field label="Your name" htmlFor="fullName" error={errors.fullName}>
              <TextInput
                id="fullName"
                autoComplete="name"
                value={fullName}
                invalid={Boolean(errors.fullName)}
                onChange={(event) => setFullName(event.target.value)}
              />
            </Field>
            <Field
              label="Business name"
              htmlFor="businessName"
              error={errors.businessName}
              hint="Optional, we create one from your name otherwise"
            >
              <TextInput
                id="businessName"
                value={businessName}
                invalid={Boolean(errors.businessName)}
                onChange={(event) => setBusinessName(event.target.value)}
              />
            </Field>
          </>
        )}

        <Field label="Email" htmlFor="email" error={errors.email}>
          <TextInput
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            invalid={Boolean(errors.email)}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          error={errors.password}
          hint={isSignup ? "At least 8 characters with upper, lower and a number" : undefined}
        >
          <TextInput
            id="password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            value={password}
            invalid={Boolean(errors.password)}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        {failure && <Alert message={failure} onDismiss={() => setFailure(null)} />}

        <Button type="submit" loading={submitting} className="w-full">
          {isSignup ? "Create account" : "Sign in"}
        </Button>
      </form>

      {!isSignup && (
        <button
          type="button"
          className="w-full rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-slate-100"
          onClick={() => {
            setEmail(DEMO_CREDENTIALS.email);
            setPassword(DEMO_CREDENTIALS.password);
          }}
        >
          Use the seeded demo account
        </button>
      )}

      <p className="text-center text-sm text-slate-500">
        {isSignup ? "Already have an account? " : "New here? "}
        <Link
          href={isSignup ? "/login" : "/signup"}
          className="font-medium text-indigo-600 hover:text-indigo-700"
        >
          {isSignup ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}
