import type { Message } from 'ai';
import { Fragment, useState } from 'react';
import { classNames } from '@/utils/classNames';
import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';
import { useSearchParams, useRouter } from 'next/navigation';
import { chatId, appId } from '@/lib/persistence/useChatHistory';
import { toast } from 'react-toastify';
import WithTooltip from '@/components/ui/Tooltip';
import { useStore } from '@nanostores/react';
import { profileStore } from '@/lib/stores/profile';
import { forwardRef } from 'react';
import type { ForwardedRef } from 'react';
import { Dialog, DialogRoot, DialogTitle, DialogDescription, DialogButton } from '@/components/ui/Dialog';

interface MessagesProps {
  id?: string;
  className?: string;
  isStreaming?: boolean;
  messages?: Message[];
  saveChat?: (messageId?: string) => Promise<void>;
}

export const Messages = forwardRef<HTMLDivElement, MessagesProps>(
  (props: MessagesProps, ref: ForwardedRef<HTMLDivElement> | undefined) => {
    const { id, isStreaming = false, messages = [], saveChat } = props;
    const searchParams = useSearchParams();
    const router = useRouter();
    const profile = useStore(profileStore);
    const [openDialog, setOpenDialog] = useState(false);
    const [commitSha, setCommitSha] = useState<any>(null);
    const [currentMessageId, setCurrentMessageId] = useState<string>('');

    const handleRewind = async (messageId: string, commitSha: any) => {
      setCommitSha(commitSha);
      setCurrentMessageId(messageId);
      setOpenDialog(true);
    };

    const closeDialog = () => {
      setOpenDialog(false);
    };

    const handleFork = async (messageId: string) => {
      try {
        const currentChatId = chatId.get();
        if (!currentChatId) {
          toast.error('Chat ID is not available');
          return;
        }

        const response = await fetch(`/api/chats/${currentChatId}/fork`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ messageId }),
        });

        if (!response.ok) {
          throw new Error('Failed to fork chat');
        }

        const result = (await response.json()) as { urlId: string };
        window.location.href = `/chat/${result.urlId}`;
      } catch (error) {
        toast.error('Failed to fork chat: ' + (error as Error).message);
      }
    };

    return (
      <div id={id} className={props.className} ref={ref}>
        {messages.length > 0
          ? messages.map((message, index) => {
              const { role, content, id: messageId, annotations } = message;
              const isUserMessage = role === 'user';
              const isFirst = index === 0;
              const isLast = index === messages.length - 1;
              const isHidden = annotations?.includes('hidden');

              if (isHidden) {
                return <Fragment key={index} />;
              }

              return (
                <div
                  key={index}
                  className={classNames('flex gap-4 p-6 w-full rounded-[calc(0.75rem-1px)]', {
                    'bg-bolt-elements-messages-background': isUserMessage || !isStreaming || (isStreaming && !isLast),
                    'bg-gradient-to-b from-bolt-elements-messages-background from-30% to-transparent':
                      isStreaming && isLast,
                    'mt-4': !isFirst,
                  })}
                >
                  {isUserMessage && (
                    <div className="flex items-center justify-center w-[40px] h-[40px] overflow-hidden bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-500 rounded-full shrink-0 self-start">
                      {profile?.avatar ? (
                        <img
                          src={profile.avatar}
                          alt={profile?.username || 'User'}
                          className="w-full h-full object-cover"
                          loading="eager"
                          decoding="sync"
                        />
                      ) : (
                        <div className="i-ph:user-fill text-2xl" />
                      )}
                    </div>
                  )}
                  <div className="grid grid-col-1 w-full">
                    {isUserMessage ? (
                      <UserMessage content={content} />
                    ) : (
                      <AssistantMessage content={content} annotations={message.annotations} />
                    )}
                  </div>
                  {!isUserMessage && (
                    <div className="flex gap-2 flex-col lg:flex-row">
                      {messageId && message.annotations?.find((annotation) => (annotation as { type: string }).type === 'commitSha') && (
                        <WithTooltip tooltip="Revert to this message">
                          <button
                            onClick={() => handleRewind(messageId, message.annotations?.find((annotation) => (annotation as { type: string }).type === 'commitSha'))}
                            key="i-ph:arrow-u-up-left"
                            className={classNames(
                              'i-ph:arrow-u-up-left',
                              'text-xl text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors',
                            )}
                          />
                        </WithTooltip>
                      )}
{/* 
                      <WithTooltip tooltip="Fork chat from this message">
                        <button
                          onClick={() => handleFork(messageId)}
                          key="i-ph:git-fork"
                          className={classNames(
                            'i-ph:git-fork',
                            'text-xl text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors',
                          )}
                        />
                      </WithTooltip> */}
                    </div>
                  )}
                </div>
              );
            })
          : null}
        {isStreaming && (
          <div className="text-center w-full text-bolt-elements-textSecondary i-svg-spinners:3-dots-fade text-4xl mt-4"></div>
        )}

            <DialogRoot open={openDialog}>
              <Dialog onBackdrop={closeDialog} onClose={closeDialog}>
              <>
                    <div className="p-6 bg-white dark:bg-gray-950">
                      <DialogTitle className="text-gray-900 dark:text-white">Revert Chat?</DialogTitle>
                      <DialogDescription className="mt-2 text-gray-600 dark:text-gray-400">                   
                          <span className="mt-2"> Are you sure you want to revert to this message?</span>
                      </DialogDescription>
                    </div>
                    <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
                      <DialogButton type="secondary" onClick={closeDialog}>
                        Cancel
                      </DialogButton>
                      <DialogButton
                        type="danger"
                        onClick={async (event) => {
                           const response = await fetch('/api/revert', {
                              method: 'POST',
                              body: JSON.stringify({ appName: appId.get(), commitSha: commitSha.commitSha }),
                            });

                            
                            closeDialog();

                            // await fetch('/api/chats', {
                            //   method: 'POST',
                            //   body: JSON.stringify({
                            //     id: chatId.get(),
                            //     messages: truncatedMessages,
                            //     urlId: appId.get(),
                            //   }),
                            // });
                            await saveChat?.(currentMessageId);

                            // const searchParams = new URLSearchParams(location.search);
                            // searchParams.set('rewindTo', currentMessageId);
                            window.location.search = searchParams.toString();
                        }}
                      >
                        Revert
                      </DialogButton>
                    </div>
                  </>
              </Dialog>
            </DialogRoot>
      </div>
    );
  },
);
