"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { lusitana } from "@/app/ui/fonts";
import { AlertCircle, ArrowRight, User, Mail, Lock, ShieldCheck, KeyRound } from "lucide-react";
import { GlobeAltIcon } from "@heroicons/react/24/outline";
import { register } from "@/app/lib/auth-actions";
import { useActionState } from "react";
import { Suspense } from "react";
import Link from "next/link";

const COOLDOWN_SEC = 60;

function RegisterContent() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFormFocused, setIsFormFocused] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [countdown, setCountdown] = useState(0);
  const [codeSendError, setCodeSendError] = useState<string | null>(null);
  const [codeSendLoading, setCodeSendLoading] = useState(false);

  const [registerError, registerAction, registerPending] = useActionState(register, undefined);

  const handleSendCode = useCallback(async () => {
    const form = formRef.current;
    if (!form) return;
    const emailEl = form.querySelector<HTMLInputElement>('input[name="email"]');
    const email = emailEl?.value?.trim() ?? "";
    if (!email) {
      setCodeSendError("请先填写邮箱地址");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setCodeSendError("请输入有效的邮箱地址");
      return;
    }
    setCodeSendError(null);
    setCodeSendLoading(true);
    try {
      const res = await fetch("/api/auth/send-verification-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCodeSendError(data.error ?? "发送失败");
        return;
      }
      setCountdown(COOLDOWN_SEC);
    } finally {
      setCodeSendLoading(false);
    }
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => (c <= 0 ? 0 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // 监听表单焦点状态
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    const handleFocusIn = () => setIsFormFocused(true);
    const handleFocusOut = (e: FocusEvent) => {
      if (!form.contains(e.relatedTarget as Node)) {
        setIsFormFocused(false);
      }
    };

    form.addEventListener("focusin", handleFocusIn);
    form.addEventListener("focusout", handleFocusOut);

    return () => {
      form.removeEventListener("focusin", handleFocusIn);
      form.removeEventListener("focusout", handleFocusOut);
    };
  }, []);

  const handleMouseEnter = () => {
    if (!isMobile) setIsExpanded(true);
  };

  const handleMouseLeave = () => {
    if (!isMobile && !isFormFocused) {
      setIsExpanded(false);
    }
  };

  const handleClick = () => {
    if (isMobile) setIsExpanded(!isExpanded);
  };

  useEffect(() => {
    if (!isFormFocused && !isMobile) {
      const timer = setTimeout(() => {
        const container = document.querySelector(".landing-container");
        if (container && !container.matches(":hover")) {
          setIsExpanded(false);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isFormFocused, isMobile]);

  return (
    <div
      className={`landing-container landing-container-large absolute w-full h-full overflow-hidden ${isExpanded ? "expanded" : ""}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {/* 四个颜色块 - 粉紫色系 */}
      <div className="landing-panel landing-panel-r1" />
      <div className="landing-panel landing-panel-r2" />
      <div className="landing-panel landing-panel-r3" />
      <div className="landing-panel landing-panel-r4" />

      {/* 品牌元素 - 未展开时显示 */}
      <div className="landing-brand">
        <div className="flex items-center justify-center gap-3 mb-4">
          <GlobeAltIcon className="h-12 w-12 md:h-16 md:w-16 rotate-[15deg]" />
          <h1 className={`${lusitana.className} text-4xl md:text-6xl font-bold`}>
            Silea CRM
          </h1>
        </div>
        <p className="text-lg md:text-xl text-white/90 mb-6">
          智能线索与客户管理平台
        </p>
        <div className="flex items-center justify-center gap-2 text-white/60 text-sm animate-pulse">
          <span>{isMobile ? "点击注册" : "移入鼠标注册"}</span>
          <ArrowRight className="w-4 h-4" />
        </div>
      </div>

      {/* 展开后左侧信息 */}
      <div className="landing-info landing-info-left hidden md:block">
        <p className="text-2xl font-light mb-2">免费</p>
        <p className="text-sm text-white/70">注册即可体验</p>
      </div>

      {/* 展开后右侧信息 */}
      <div className="landing-info landing-info-right hidden md:block">
        <p className="text-2xl font-light mb-2">安全</p>
        <p className="text-sm text-white/70">数据加密保护</p>
      </div>

      {/* 展开后底部信息 */}
      <div className="landing-info landing-info-bottom">
        <p className="text-xs text-white/50">
          © 2026 Silea CRM · 让客户管理更简单
        </p>
      </div>

      {/* 中心注册区域 */}
      <div className="landing-center !p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className={`${lusitana.className} text-xl text-slate-700 mb-1`}>
          创建账户
        </h2>

        <form ref={formRef} action={registerAction} className="w-full">
          <div className="landing-input-wrapper-compact">
            <User className="landing-input-icon" />
            <input
              type="text"
              name="name"
              placeholder="姓名"
              required
              className="landing-input-compact"
            />
          </div>
          <div className="landing-input-wrapper-compact">
            <Mail className="landing-input-icon" />
            <input
              type="email"
              name="email"
              placeholder="邮箱地址"
              required
              className="landing-input-compact"
            />
          </div>
          <div className="flex gap-2">
            <div className="landing-input-wrapper-compact flex-1">
              <KeyRound className="landing-input-icon" />
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                name="verificationCode"
                placeholder="验证码（6位）"
                required
                className="landing-input-compact"
              />
            </div>
            <button
              type="button"
              onClick={handleSendCode}
              disabled={codeSendLoading || countdown > 0}
              className="shrink-0 px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {countdown > 0 ? `${countdown}s 后重试` : codeSendLoading ? "发送中..." : "获取验证码"}
            </button>
          </div>
          {codeSendError && (
            <div className="flex items-center gap-2 text-red-500 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{codeSendError}</span>
            </div>
          )}
          <div className="landing-input-wrapper-compact">
            <Lock className="landing-input-icon" />
            <input
              type="password"
              name="password"
              placeholder="密码（至少6位）"
              required
              minLength={6}
              className="landing-input-compact"
            />
          </div>
          <div className="landing-input-wrapper-compact">
            <ShieldCheck className="landing-input-icon" />
            <input
              type="password"
              name="confirmPassword"
              placeholder="确认密码"
              required
              minLength={6}
              className="landing-input-compact"
            />
          </div>
          <button
            type="submit"
            disabled={registerPending}
            className="landing-btn landing-btn-register !py-3 !mt-2"
          >
            {registerPending ? "注册中..." : "注册"}
          </button>

          {registerError && (
            <div className="mt-2 flex items-center gap-2 text-red-500 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{registerError}</span>
            </div>
          )}
        </form>

        <p className="mt-3 text-sm text-slate-500">
          已有账户？
          <Link href="/login" className="text-pink-600 hover:text-pink-700 ml-1">
            立即登录
          </Link>
        </p>

        {isMobile && (
          <p className="mt-2 text-xs text-slate-400">点击空白处返回</p>
        )}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-slate-100">
      <Suspense
        fallback={
          <div className="w-full h-screen bg-slate-900 flex items-center justify-center">
            <div className="text-white text-xl">加载中...</div>
          </div>
        }
      >
        <RegisterContent />
      </Suspense>
    </main>
  );
}
