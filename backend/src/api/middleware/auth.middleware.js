const supabase = require('../../config/supabase.config')

const profileFromAuthUser = (authUser) => {
  const rawProvider = authUser.app_metadata?.provider || authUser.raw_app_meta_data?.provider
  const provider = rawProvider === 'google' ? 'google' : 'email'
  const fullName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email
  return {
    id: authUser.id,
    email: authUser.email,
    name: fullName,
    full_name: fullName,
    avatar: authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || null,
    auth_provider: provider,
    role: 'client',
    is_verified: Boolean(authUser.email_confirmed_at),
    is_active: true,
  }
}

const findOrProvisionUser = async (authUser) => {
  const { data: existing, error: existingError } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle()
  if (existingError) throw existingError
  if (existing) {
    const authVerified = Boolean(authUser.email_confirmed_at)
    if (typeof existing.is_verified === 'boolean' && existing.is_verified !== authVerified) {
      const { data: synchronized, error: syncError } = await supabase
        .from('users')
        .update({ is_verified: authVerified, updated_at: new Date().toISOString() })
        .eq('id', authUser.id)
        .select()
        .single()
      if (!syncError && synchronized) return synchronized
      console.warn('Profile verification state could not be synchronized')
    }
    return existing
  }

  const { data: created, error: createError } = await supabase
    .from('users')
    .insert([profileFromAuthUser(authUser)])
    .select()
    .single()
  if (createError) throw createError
  return created
}

const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) {
      return res.status(401).json({ message: 'No token provided' })
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(token)
    if (authError || !authData?.user) {
      return res.status(401).json({ message: 'Invalid session' })
    }

    const user = await findOrProvisionUser(authData.user)
    if (!user) {
      return res.status(401).json({ message: 'Invalid token' })
    }

    if (user.is_active === false) {
      return res.status(403).json({
        message: 'Your account has been deactivated. Please contact support.',
        code: 'ACCOUNT_INACTIVE'
      })
    }

    req.user = user
    next()
  } catch (err) {
    console.error('❌ Auth error:', err)
    res.status(401).json({ message: 'Authentication failed' })
  }
}

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' })
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' })
    }
    next()
  }
}

module.exports = { authenticate, authorize, findOrProvisionUser }
