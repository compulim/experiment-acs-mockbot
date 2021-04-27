import {
  Activity,
  ActivityHandler,
  ActivityTypes,
  BotAdapter,
  ConversationReference,
  ResourceResponse,
  TextFormatTypes,
  TurnContext
} from 'botbuilder-core';
import { ChatClient } from '@azure/communication-chat';
import decode from 'jwt-decode';

export default class ACSBotAdapter extends BotAdapter {
  constructor({ endpointURL, token }: { endpointURL: string; token: string }) {
    super();

    this.chatClient = new ChatClient(endpointURL, {
      dispose: () => {},
      getToken: () =>
        Promise.resolve({
          expiresOnTimestamp: Infinity,
          token
        })
    });

    this.endpointURL = endpointURL;
    this.userId = `8:${decode(token)['skypeid']}`;
  }

  private chatClient: ChatClient;
  private endpointURL: string;
  private userId: string;

  public async attach(activityHandler: ActivityHandler) {
    await this.chatClient.startRealtimeNotifications();

    this.chatClient.on('chatMessageReceived', event => {
      console.log('chatMessageReceived', event);

      if (event.sender.kind === 'communicationUser' && event.sender.communicationUserId === this.userId) {
        return;
      }

      const activity: Partial<Activity> = {
        channelId: 'acs',
        conversation: {
          conversationType: '',
          id: event.threadId,
          isGroup: true,
          name: ''
        },
        from: {
          id: event.sender.kind === 'communicationUser' ? event.sender.communicationUserId : '',
          name: event.senderDisplayName
        },
        recipient: {
          id: event.recipient.kind === 'communicationUser' ? event.recipient.communicationUserId : '',
          name: ''
        },
        serviceUrl: this.endpointURL,
        text: event.message,
        textFormat: TextFormatTypes.Plain,
        type: ActivityTypes.Message
      };

      activityHandler.run(new TurnContext(this, activity));
    });

    this.chatClient.on('participantsAdded', event => {
      console.log('participantsAdded', event);

      const activity: Partial<Activity> = {
        conversation: {
          conversationType: '',
          id: event.threadId,
          isGroup: true,
          name: ''
        },
        membersAdded: event.participantsAdded.reduce((membersAdded, participant) => {
          participant.id.kind === 'communicationUser' &&
            membersAdded.push({
              id: participant.id.communicationUserId,
              name: participant.displayName
            });

          return membersAdded;
        }, []),
        recipient: {
          id: this.userId,
          name: ''
        },
        type: ActivityTypes.ConversationUpdate
      };

      activityHandler.run(new TurnContext(this, activity));
    });

    this.chatClient.on('participantsRemoved', event => {
      console.log('participantsRemoved', event);

      const activity: Partial<Activity> = {
        conversation: {
          conversationType: '',
          id: event.threadId,
          isGroup: true,
          name: ''
        },
        membersRemoved: event.participantsRemoved.reduce((membersRemoved, participant) => {
          participant.id.kind === 'communicationUser' &&
            membersRemoved.push({
              id: participant.id.communicationUserId,
              name: participant.displayName
            });

          return membersRemoved;
        }, []),
        recipient: {
          id: this.userId,
          name: ''
        },
        type: ActivityTypes.ConversationUpdate
      };

      activityHandler.run(new TurnContext(this, activity));
    });
  }

  public async sendActivities(context: TurnContext, activities: Partial<Activity>[]): Promise<ResourceResponse[]> {
    const chatThreadClient = this.chatClient.getChatThreadClient(context.activity.conversation.id);

    return await Promise.all(
      activities
        .filter(activity => {
          if (activity.type !== 'message') {
            throw new Error(`Cannot send unsupported activity type of "${activity.type}"`);
          }

          return true;
        })
        .map(async activity => {
          const result = await chatThreadClient.sendMessage({
            content: activity.text
          });

          return { id: result.id };
        })
    );
  }

  public async updateActivity(context: TurnContext, activity: Partial<Activity>): Promise<ResourceResponse | void> {
    throw new Error('not supported');
  }

  public async deleteActivity(context: TurnContext, reference: Partial<ConversationReference>): Promise<void> {
    throw new Error('not supported');
  }

  public async continueConversation(
    reference: Partial<ConversationReference>,
    logic: (revocableContext: TurnContext) => Promise<void>
  ): Promise<void> {
    throw new Error('not supported');
  }

  // public async processActivity(activity: Activity, logic: (context: TurnContext) => Promise<any>): Promise<void> {
  //   const context = new TurnContext(this, activity);

  //   await this.runMiddleware(context, logic);
  // }
}
