"use client";

import { lusitana } from "@/app/ui/fonts";
import { Mail, Key, AlertCircle, ArrowRight, CheckCircle } from "lucide-react";
import { authenticate } from "../lib/auth-actions";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";

export default function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const registered = searchParams.get("registered") === "true";
  const [errorMessage, formAction, isPending] = useActionState(authenticate, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div className="rounded-xl bg-white/95 backdrop-blur-sm px-8 pb-8 pt-10 shadow-2xl">
        <h1 className={`${lusitana.className} mb-2 text-2xl text-slate-800 text-center`}>
          登录账户
        </h1>
        <p className="text-sm text-slate-500 text-center mb-6">
          欢迎回来，请输入您的登录信息
        </p>

        {registered && (
          <div className="mb-6 flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
            <p className="text-sm font-medium text-green-700">注册成功！请登录您的账户。</p>
          </div>
        )}

        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="email">
              邮箱地址
            </label>
            <div className="relative">
              <input
                className="peer block w-full rounded-lg border border-slate-200 bg-slate-50/50 py-3 pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all"
                id="email"
                type="email"
                name="email"
                placeholder="请输入邮箱地址"
                required
              />
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400 peer-focus:text-cyan-600 transition-colors" />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="password">
              密码
            </label>
            <div className="relative">
              <input
                className="peer block w-full rounded-lg border border-slate-200 bg-slate-50/50 py-3 pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all"
                id="password"
                type="password"
                name="password"
                placeholder="请输入密码"
                required
                minLength={6}
              />
              <Key className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400 peer-focus:text-cyan-600 transition-colors" />
            </div>
          </div>
        </div>

        <input type="hidden" name="redirectTo" value={callbackUrl} />

        <button
          type="submit"
          disabled={isPending}
          className="mt-6 w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/30 hover:from-cyan-600 hover:to-blue-600 hover:shadow-cyan-500/40 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
          {isPending ? (
            <>
              <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>登录中...</span>
            </>
          ) : (
            <>
              <span>登录</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>

        {errorMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-600">{errorMessage}</p>
          </div>
        )}

        <div className="mt-6 text-center">
          <a href="/register" className="text-sm text-slate-500 hover:text-cyan-600 transition-colors">
            还没有账户？<span className="font-medium text-cyan-600">立即注册</span>
          </a>
        </div>
      </div>
    </form>
  );
}
