router.get("/categories", auth, forum.getCategories);

router.get("/topics", auth, forum.getTopics);
router.get("/topics/:id", auth, forum.getTopic);
router.post("/topics", auth, forum.createTopic);

router.get("/topics/:id/replies", auth, forum.getReplies);
router.post("/topics/:id/replies", auth, forum.addReply);

router.post("/replies/:id/like", auth, forum.likeReply);
router.post("/replies/:id/best", auth, isInstructorOrAdmin, forum.markBestAnswer);

router.get("/stats", auth, forum.getForumStats);
router.get("/activity", auth, forum.getRecentActivity);
