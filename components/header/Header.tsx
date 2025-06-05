'use client';
import { useStore } from '@nanostores/react';
import { chatStore } from '@/lib/stores/chat';
import { classNames } from '@/utils/classNames';
import { HeaderActionButtons } from './HeaderActionButtons.client';
import { ChatDescription } from '@/lib/persistence/ChatDescription.client';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { useSession } from "next-auth/react"
import { Badge } from '@/components/ui/Badge';

export function Header() {
  const chat = useStore(chatStore);
  const { data: session } = useSession();

  return (
    <header
      className={classNames('flex items-center p-5 border-b h-[var(--header-height)]', {
        'border-transparent': !chat.started,
        'border-bolt-elements-borderColor': chat.started,
      })}
    >
      <div className="flex items-center gap-2 z-logo text-bolt-elements-textPrimary cursor-pointer">
        {/* <div className="i-ph:sidebar-simple-duotone text-xl" /> */}
        <a href="/" className="text-2xl font-semibold text-accent flex items-center">
          {/* <span className="i-bolt:logo-text?mask w-[46px] inline-block" /> */}
          <span className="inline-block mr-1">genfly</span>
          <img src="/logo-04.png" alt="logo" className="w-[24px] inline-block dark:hidden" />
          <img src="/logo-04.png" alt="logo" className="w-[24px] inline-block hidden dark:block" />
        </a>
        <Badge variant="outline" className="bg-green-500 text-white">
          <span className="text-xs">Beta</span>
        </Badge>
      </div>
      {chat.started && ( // Display ChatDescription and HeaderActionButtons only when the chat has started.
        <>
          <span className="flex-1 px-4 truncate text-center text-bolt-elements-textPrimary">
            <ChatDescription />
          </span>
          <div className="mr-1">
            <HeaderActionButtons />
          </div>
        </>
      )}
      {!session && (
       <div className="flex items-center gap-4 ml-auto z-10">
          <Link
            href="/login"
          >
            <Button size="sm" className="hover:bg-black/10 dark:hover:bg-white/10">Sign In</Button>
          </Link>
          <Link
            href="/login"
          >
            <Button size="sm" className="bg-purple-500 dark:bg-purple-500 text-purple-700 dark:text-purple-200 hover:bg-purple-100 dark:hover:bg-purple-500/80 rounded-lg">Get Started</Button>
          </Link>
        </div>
      )}
    </header>
  );
}
