import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import useViewport from '@/lib/hooks';
import { chatStore } from '@/lib/stores/chat';
import { workbenchStore } from '@/lib/stores/workbench';
import { classNames } from '@/utils/classNames';
import { Button as ButtonUI } from '@/components/ui/Button';
import { chatId, appId } from '@/lib/persistence/useChatHistory';
import { supabase } from '@/lib/supabase';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/shadui/popover"

interface HeaderActionButtonsProps {}

export function HeaderActionButtons({}: HeaderActionButtonsProps) {
  const showWorkbench = useStore(workbenchStore.showWorkbench);
  const { showChat } = useStore(chatStore);

  const isSmallViewport = useViewport(1024);

  const canHideChat = showWorkbench || !showChat;

  const [clientId] = useState<string>(chatId.get() || "");
  const [isDeploying, setIsDeploying] = useState(false);

  const [deployStatus, setDeployStatus] = useState<string>('');

  const [deployInfo, setDeployInfo] = useState<any>({});

  // 订阅特定客户端的频道
  useEffect(() => {
    const channel = supabase
      .channel(`private:${clientId}`)
      .on('broadcast', { event: 'message' }, (payload: { payload: any }) => {
         setDeployStatus(payload.payload.status);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [clientId]);

  return (
    <div className="flex">
      <div className="flex border border-bolt-elements-borderColor rounded-md overflow-hidden">
        {/* <Button
          active={showChat}
          disabled={!canHideChat || isSmallViewport} // expand button is disabled on mobile as it's not needed
          onClick={() => {
            if (canHideChat) {
              chatStore.setKey('showChat', !showChat);
            }
          }}
        >
          <div className="i-bolt:chat text-sm" />
        </Button>
        <div className="w-[1px] bg-bolt-elements-borderColor" />
        <Button
          active={showWorkbench}
          onClick={() => {
            if (showWorkbench && !showChat) {
              chatStore.setKey('showChat', true);
            }

            workbenchStore.showWorkbench.set(!showWorkbench);
          }}
        >
          <div className="i-ph:code-bold" />
        </Button> */}

        <Popover>
          <PopoverTrigger asChild>
          <ButtonUI 
              onClick={async () => {
                const res = await fetch(`/api/get-deploy-info/${chatId.get()}`);

                const data = await res.json();
                setDeployInfo(data);

                setDeployStatus(data.status);
              }}
              className="!bg-blue-500 !text-white hover:!bg-blue-600 relative flex items-center justify-center"
            >
              deploy
            </ButtonUI>
          </PopoverTrigger>
          <PopoverContent className="w-80 bg-white">
            <div className="grid gap-6 p-2">
              <div className="space-y-3">
                <h4 className="font-semibold text-lg text-gray-900">Deploy to Netlify</h4>
                <p className="text-sm text-gray-600">
                  Deploy your application to Netlify to make it live.
                </p>
              </div>
              {
                deployInfo.url && (
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <a 
                      href={deployInfo.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 hover:underline transition-colors duration-200 break-all"
                    >
                      {deployInfo.url}
                    </a>
                  </div>
                )
              }
              <ButtonUI 
                className="bg-black hover:bg-gray-800 text-white transition-colors duration-200 shadow-sm hover:shadow-md" 
                onClick={async () => {
                  setIsDeploying(true);
                  if (deployStatus === 'pending') {
                    return;
                  }
                  setDeployStatus('pending');

                  const res = await fetch('/api/deploy-to-netlify', {
                    method: 'POST',
                    body: JSON.stringify({ 
                      repo: `wordixai/genfly-app-${chatId.get()}`,
                      siteName: chatId.get(),
                      appId: chatId.get()
                    }),
                  });

                  const data = await res.json();
                  setDeployStatus(data.status);
                  setDeployInfo(data);
                }}
              >
                {deployStatus === 'pending' ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Deploying...</span>
                  </div>
                ) : (
                  deployStatus === 'no' || deployStatus === '' ? 'Deploy Now' : 'Redeploy'
                )}
              </ButtonUI>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

interface ButtonProps {
  active?: boolean;
  disabled?: boolean;
  children?: any;
  onClick?: VoidFunction;
}

function Button({ active = false, disabled = false, children, onClick }: ButtonProps) {
  return (
    <button
      className={classNames('flex items-center p-1.5', {
        'bg-bolt-elements-item-backgroundDefault hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary':
          !active,
        'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent': active && !disabled,
        'bg-bolt-elements-item-backgroundDefault text-alpha-gray-20 dark:text-alpha-white-20 cursor-not-allowed':
          disabled,
      })}
      onClick={onClick}
    >
      {children}
    </button>
  );
}