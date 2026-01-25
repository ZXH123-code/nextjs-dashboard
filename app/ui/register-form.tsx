"use client";

import { lusitana } from "@/app/ui/fonts";
import { Mail, Key, AlertCircle, ArrowRight, User } from "lucide-react";
import { register } from "../lib/auth-actions";
import { useActionState } from "react";

export default function RegisterForm() {
  const [errorMessage, formAction, isPending] = useActionState(register, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div className="rounded-xl bg-white/95 backdrop-blur-sm px-8 pb-8 pt-10 shadow-2xl">
        <h1 className={`${lusitana.className} mb-2 text-2xl text-slate-800 text-center`}>
          创建账户
        </h1>
        <p className="text-sm text-slate-500 text-center mb-6">
          填写以下信息，开始您的旅程
        </p>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="name">
              姓名
            </label>
            <div className="relative">
              <input
                className="peer block w-full rounded-lg border border-slate-200 bg-slate-50/50 py-3 pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-rose-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all"
                id="name"
                type="text"
                name="name"
                placeholder="请输入您的姓名"
                required
              />
              <User className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400 peer-focus:text-rose-500 transition-colors" />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="email">
              邮箱地址
            </label>
            <div className="relative">
              <input
                className="peer block w-full rounded-lg border border-slate-200 bg-slate-50/50 py-3 pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-rose-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all"
                id="email"
                type="email"
                name="email"
                placeholder="请输入您的邮箱地址"
                required
              />
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400 peer-focus:text-rose-500 transition-colors" />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="password">
              密码
            </label>
            <div className="relative">
              <input
                className="peer block w-full rounded-lg border border-slate-200 bg-slate-50/50 py-3 pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-rose-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all"
                id="password"
                type="password"
                name="password"
                placeholder="请输入密码（至少6位）"
                required
                minLength={6}
              />
              <Key className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400 peer-focus:text-rose-500 transition-colors" />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="confirmPassword">
              确认密码
            </label>
            <div className="relative">
              <input
                className="peer block w-full rounded-lg border border-slate-200 bg-slate-50/50 py-3 pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-rose-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all"
                id="confirmPassword"
                type="password"
                name="confirmPassword"
                placeholder="请再次输入密码"
                required
                minLength={6}
              />
              <Key className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400 peer-focus:text-rose-500 transition-colors" />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="mt-6 w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-rose-500 to-pink-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-500/30 hover:from-rose-600 hover:to-pink-600 hover:shadow-rose-500/40 focus:outline-none focus:ring-2 focus:ring-rose-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
          {isPending ? (
            <>
              <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>注册中...</span>
            </>
          ) : (
            <>
              <span>注册</span>
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
          <a href="/login" className="text-sm text-slate-500 hover:text-rose-500 transition-colors">
            已有账户？<span className="font-medium text-rose-500">立即登录</span>
          </a>
        </div>
      </div>
    </form>
  );
}
