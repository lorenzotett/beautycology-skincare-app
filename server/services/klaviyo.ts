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
      console.log(`Attempting to add ${email} to Klaviyo list ${this.listId}`);
      
      // Step 1: Create or get profile
      const profile = await this.createOrGetProfile(email, name, sessionData);
      if (!profile) {
        console.error('Failed to create profile');
        return false;
      }

      // Step 2: Add profile to list using the List Relationships API
      const listData = {
        data: [{
          type: "profile",
          id: profile.id
        }]
      };

      const response = await fetch(`${this.baseUrl}/lists/${this.listId}/relationships/profiles/`, {
        method: 'POST',
        headers: {
          'Authorization': `Klaviyo-API-Key ${this.apiKey}`,
          'Content-Type': 'application/vnd.api+json',
          'revision': '2025-07-15'
        },
        body: JSON.stringify(listData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to add profile to list:', errorText);
        return false;
      }

      console.log(`Successfully added ${email} to Klaviyo list`);
      return true;
    } catch (error) {
      console.error('Klaviyo integration error:', error);
      return false;
    }
  }

  private async createOrGetProfile(email: string, name: string, sessionData?: any): Promise<any> {
    try {
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

      const response = await fetch(`${this.baseUrl}/profiles/`, {
        method: 'POST',
        headers: {
          'Authorization': `Klaviyo-API-Key ${this.apiKey}`,
          'Content-Type': 'application/vnd.api+json',
          'revision': '2025-07-15'
        },
        body: JSON.stringify(profileData)
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`Profile created with ID: ${result.data.id}`);
        return result.data;
      } else {
        const errorText = await response.text();
        console.log('Profile creation failed, might already exist:', errorText);
        
        // Try to find existing profile by email
        const searchResponse = await fetch(`${this.baseUrl}/profiles/?filter=equals(email,"${email}")`, {
          method: 'GET',
          headers: {
            'Authorization': `Klaviyo-API-Key ${this.apiKey}`,
            'Accept': 'application/vnd.api+json',
            'revision': '2025-07-15'
          }
        });

        if (searchResponse.ok) {
          const searchResult = await searchResponse.json();
          if (searchResult.data && searchResult.data.length > 0) {
            console.log(`Found existing profile with ID: ${searchResult.data[0].id}`);
            return searchResult.data[0];
          }
        }
        
        return null;
      }
    } catch (error) {
      console.error('Error creating/getting profile:', error);
      return null;
    }
  }


}