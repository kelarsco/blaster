import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { API } from '../api.js';
import { Send, Check, X, Mail } from 'react-feather';

const SKELETON_DURATION_MS = 1500;

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded bg-blaster-border/60 ${className}`} />;
}

export default function DashboardPage() {
  const { user, subscription, authFetch } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats] = useState({ total: 0, sent: 0, failed: 0 });
  const [emailsExtracted, setEmailsExtracted] = useState(0);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeStep, setActiveStep] = useState(1);

  const formatActivityTime = (iso) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const day = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      return `${day} ${time}`;
    } catch {
      return '';
    }
  };

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    
    try {
      const [campaignsRes, activityRes] = await Promise.all([
        authFetch(`${API}/campaigns`),
        authFetch(`${API}/activity`)
      ]);

      const campaignList = (await campaignsRes.json())?.data || [];
      const activityList = (await activityRes.json())?.data || [];
      
      setCampaigns(campaignList);
      setActivity(activityList);
      
      // Calculate stats
      const total = campaignList.reduce((sum, c) => sum + (c.totalEmails || 0), 0);
      const sent = campaignList.reduce((sum, c) => sum + (c.sentEmails || 0), 0);
      const failed = campaignList.reduce((sum, c) => sum + (c.failedEmails || 0), 0);
      
      setStats({ total, sent, failed });
      setEmailsExtracted(activityList.reduce((sum, a) => sum + (a.emailsFound || 0), 0));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [user, authFetch]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const recentActivity = activity.slice(0, 5);

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Welcome back! Here's what's happening with your email campaigns.</p>
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-6">
                <Skeleton className="h-6 w-24 mb-2" />
                <Skeleton className="h-8 w-16 mb-4" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center space-x-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-48 mb-1" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-blue-100 rounded-lg p-3">
                  <Mail className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Emails</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-green-100 rounded-lg p-3">
                  <Send className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Sent</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.sent}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-red-100 rounded-lg p-3">
                  <X className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Failed</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.failed}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-purple-100 rounded-lg p-3">
                  <Check className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Emails Extracted</p>
                  <p className="text-2xl font-bold text-gray-900">{emailsExtracted}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Campaigns */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Recent Campaigns</h2>
              <Link
                to="/app/campaigns"
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                View all →
              </Link>
            </div>
            
            {campaigns.length === 0 ? (
              <div className="text-center py-8">
                <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">No campaigns yet</p>
                <Link
                  to="/app/scanner"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Start Your First Campaign
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {campaigns.slice(0, 3).map(campaign => (
                  <div key={campaign.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">{campaign.name}</h3>
                        <p className="text-sm text-gray-600">
                          {campaign.totalEmails} emails • {campaign.sentEmails} sent
                        </p>
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatActivityTime(campaign.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
            
            {activity.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">No recent activity</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      {activity.type === 'email_sent' ? (
                        <Send className="h-5 w-5 text-green-600" />
                      ) : activity.type === 'scan_completed' ? (
                        <Check className="h-5 w-5 text-blue-600" />
                      ) : (
                        <Mail className="h-5 w-5 text-gray-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">{activity.description}</p>
                      <p className="text-xs text-gray-500">{formatActivityTime(activity.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
