interface KlaviyoProfile {
  email: string;
  first_name?: string;
  properties?: Record<string, any>;
}

interface KlaviyoListMember {
  profiles: string[];
}

export class KlaviyoService {
  private apiKey: string;
  private listId: string;
  private baseUrl = 'https://a.klaviyo.com/api';

  constructor(apiKey: string, listId: string) {
    this.apiKey = apiKey;
    this.listId = listId;
  }

  async addProfileToList(email: string, name: string, sessionData?: any): Promise<boolean> {
    try {
      // First create/update the profile
      const profileData = {
        data: {
          type: "profile",
          attributes: {
            email: email,
            first_name: name,
            properties: {
              source: "AI-DermaSense Chat",
              session_date: new Date().toISOString(),
              ...sessionData
            }
          }
        }
      };

      const profileResponse = await fetch(`${this.baseUrl}/profiles/`, {
        method: 'POST',
        headers: {
          'Authorization': `Klaviyo-API-Key ${this.apiKey}`,
          'Content-Type': 'application/json',
          'revision': '2024-10-15'
        },
        body: JSON.stringify(profileData)
      });

      if (!profileResponse.ok) {
        const errorText = await profileResponse.text();
        console.error('Klaviyo profile creation failed:', errorText);
        return false;
      }

      const profileResult = await profileResponse.json();
      const profileId = profileResult.data.id;

      // Then add the profile to the list
      const listMemberData = {
        data: {
          type: "profile-subscription-bulk-create-job",
          attributes: {
            profiles: {
              data: [{
                type: "profile",
                id: profileId
              }]
            }
          },
          relationships: {
            list: {
              data: {
                type: "list",
                id: this.listId
              }
            }
          }
        }
      };

      const listResponse = await fetch(`${this.baseUrl}/profile-subscription-bulk-create-jobs/`, {
        method: 'POST',
        headers: {
          'Authorization': `Klaviyo-API-Key ${this.apiKey}`,
          'Content-Type': 'application/json',
          'revision': '2024-10-15'
        },
        body: JSON.stringify(listMemberData)
      });

      if (!listResponse.ok) {
        const errorText = await listResponse.text();
        console.error('Klaviyo list addition failed:', errorText);
        return false;
      }

      console.log(`Successfully added ${email} to Klaviyo list`);
      return true;
    } catch (error) {
      console.error('Klaviyo integration error:', error);
      return false;
    }
  }
}