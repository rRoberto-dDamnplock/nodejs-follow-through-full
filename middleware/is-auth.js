module.exports = (req, res, next) => {
    if(!req.session.isLoggedIn){
    console.log('middleware')
        return res.redirect('/login');

    }
    next();
}