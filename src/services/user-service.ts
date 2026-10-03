import { apiClient } from '@/lib/api';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  status: string;
}

export const UserService = {
  async fetchProfile(): Promise<UserProfile> {
    return apiClient.get<UserProfile>('/user/profile');
  },

  async updateProfile(profile: Partial<UserProfile>): Promise<UserProfile> {
    return apiClient.post<UserProfile>('/user/profile', profile);
  },
};
