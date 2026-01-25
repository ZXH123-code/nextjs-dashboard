"use client";

import { useState, useEffect, useRef } from "react";
import { lusitana } from "@/app/ui/fonts";
import { AlertCircle, CheckCircle, ArrowRight, Mail, Lock } from "lucide-react";
import { GlobeAltIcon } from "@heroicons/react/24/outline";
import { authenticate } from "@/app/lib/auth-actions";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";

function LandingContent() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFormFocused, setIsFormFocused] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const registered = searchParams.get("registered") === "true";

  const [loginError, loginAction, loginPending] = useActionState(authenticate, undefined);

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
      // 检查新的焦点目标是否仍在表单内
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
    // 只有当表单没有焦点时才收起
    if (!isMobile && !isFormFocused) {
      setIsExpanded(false);
    }
  };

  const handleClick = () => {
    if (isMobile) setIsExpanded(!isExpanded);
  };

  // 当表单失去焦点且鼠标不在区域内时收起（通过 expanded 类控制）
  useEffect(() => {
    if (!isFormFocused && !isMobile) {
      // 给一个小延迟，让用户有机会将鼠标移回
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
      className={`landing-container absolute w-full h-full overflow-hidden ${isExpanded ? "expanded" : ""}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {/* 四个颜色块 */}
      <div className="landing-panel landing-panel-1" />
      <div className="landing-panel landing-panel-2" />
      <div className="landing-panel landing-panel-3" />
      <div className="landing-panel landing-panel-4" />

      {/* 品牌元素 - 未展开时显示 */}
      <div className="landing-brand">
        <div className="flex items-center justify-center gap-3 mb-4">
          <GlobeAltIcon className="h-12 w-12 md:h-16 md:w-16 rotate-[15deg]" />
          <h1 className={`${lusitana.className} text-4xl md:text-6xl font-bold`}>
            Acme
          </h1>
        </div>
        <p className="text-lg md:text-xl text-white/90 mb-6">
          数智化供应链管理平台
        </p>
        <div className="flex items-center justify-center gap-2 text-white/60 text-sm animate-pulse">
          <span>{isMobile ? "点击进入" : "移入鼠标进入"}</span>
          <ArrowRight className="w-4 h-4" />
        </div>
      </div>

      {/* 展开后左侧信息 */}
      <div className="landing-info landing-info-left hidden md:block">
        <p className="text-2xl font-light mb-2">智能</p>
        <p className="text-sm text-white/70">AI驱动的决策支持</p>
      </div>

      {/* 展开后右侧信息 */}
      <div className="landing-info landing-info-right hidden md:block">
        <p className="text-2xl font-light mb-2">高效</p>
        <p className="text-sm text-white/70">全流程数字化管理</p>
      </div>

      {/* 展开后底部信息 */}
      <div className="landing-info landing-info-bottom">
        <p className="text-xs text-white/50">
          © 2024 Acme Inc. · 让供应链更智能
        </p>
      </div>

      {/* 中心登录区域 */}
      <div className="landing-center" onClick={(e) => e.stopPropagation()}>
        <h2 className={`${lusitana.className} text-2xl text-slate-700 mb-2`}>
          欢迎登录
        </h2>

        {registered && (
          <div className="w-full mb-3 flex items-center gap-2 bg-green-50 border border-green-200 px-3 py-2 rounded text-sm">
            <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
            <span className="text-green-700">注册成功！请登录</span>
          </div>
        )}

        <form ref={formRef} action={loginAction} className="w-full">
          <div className="landing-input-wrapper">
            <Mail className="landing-input-icon" />
            <input
              type="email"
              name="email"
              placeholder="邮箱地址"
              required
              className="landing-input"
            />
          </div>
          <div className="landing-input-wrapper">
            <Lock className="landing-input-icon" />
            <input
              type="password"
              name="password"
              placeholder="密码"
              required
              minLength={6}
              className="landing-input"
            />
          </div>
          <input type="hidden" name="redirectTo" value={callbackUrl} />
          <button
            type="submit"
            disabled={loginPending}
            className="landing-btn landing-btn-primary"
          >
            {loginPending ? "登录中..." : "登录"}
          </button>

          {loginError && (
            <div className="mt-3 flex items-center gap-2 text-red-500 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{loginError}</span>
            </div>
          )}
        </form>

        <p className="mt-4 text-sm text-slate-500">
          还没有账户？
          <Link href="/register" className="text-blue-600 hover:text-blue-700 ml-1">
            立即注册
          </Link>
        </p>

        {isMobile && (
          <p className="mt-4 text-xs text-slate-400">点击空白处返回</p>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <main className="min-h-screen bg-slate-100">
      <Suspense
        fallback={
          <div className="w-full h-screen bg-slate-900 flex items-center justify-center">
            <div className="text-white text-xl">加载中...</div>
          </div>
        }
      >
        <LandingContent />
      </Suspense>
    </main>
  );
}
